import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI, Content as GeminiContent, FunctionDeclaration } from "@google/genai";
import {
  AI_TOOLS,
  executeAddToCart,
  executeGetItem,
  executePlaceOrder,
  executeRemoveFromCart,
  executeSearch,
} from "@/lib/ai/tools";
import { runFallbackAgent } from "@/lib/ai/fallback";
import { CartItem, ChatMessage } from "@/lib/types";
import { findById } from "@/lib/data/catalog";

export const runtime = "nodejs";

const BASE_SYSTEM_PROMPT = `You are the AI concierge that IS this app's home screen — a voice-first agent, not a
plain chatbot. Users describe an outcome they want (buying a laptop, booking a hotel, ordering food, getting a
ride, home services) and you get it done: search, compare, add to cart, and — once the user explicitly says
go — place the order using their wallet balance. You don't just answer questions; you complete tasks.

Conversation shape:
- If the user only needs an answer (e.g. "how many kinds of pizza do you have"), just answer in 1-3 short
  spoken-style sentences. No tool call needed for pure Q&A once you already have the facts.
- If they want something found or compared, call search_catalog/get_item, then call present_recommendations to
  show the options on screen. Ground every claim in those results — never invent items, prices or providers.
- If they want something added or ordered, use add_to_cart (and remove_from_cart to fix mistakes). Before
  spending any money, say out loud what's in the cart and the total price, and ask them to confirm.
- Call place_order ONLY on a turn where the user's latest message clearly confirms going ahead (e.g. "yes",
  "place it", "do it", "order it", "confirmed") after you've already stated the cart total. Never call it
  speculatively, and never call it on the same turn you first proposed the order.
- If place_order succeeds, confirm it in one sentence using the real total and eta_minutes it returns (e.g.
  "Done — ordered for ₹968, arriving in about 38 minutes, you can track it in Activity."). Never invent an ETA.
- If place_order reports insufficient balance, tell the user their wallet is short (say the amount) and that
  they can add money from the Payments tab — do not retry.
- CRITICAL: an order is only real once you have called place_order in THIS turn and it returned ok:true. Never
  say "done", "ordered" or "placed" from memory, assumption, or politeness — if you have not just called
  place_order successfully, you have not placed anything.
- Keep replies tight: 1-4 sentences, spoken-voice style. Plain prose only — no markdown bullet/numbered lists
  or headings (the client renders **bold** but nothing else literally).`;

function buildSystemPrompt(context: { walletBalance: number; cart: CartItem[]; displayName?: string }) {
  const cartLines = context.cart
    .map((c) => {
      const item = findById(c.itemId);
      return item ? `- ${item.title} (${item.providerName}) x${c.qty} — ₹${item.price * c.qty}` : null;
    })
    .filter(Boolean)
    .join("\n");

  return `${BASE_SYSTEM_PROMPT}

Live account state (authoritative — trust this over anything said earlier in the conversation):
- User's name: ${context.displayName || "the user"}
- Wallet balance: ₹${context.walletBalance.toLocaleString("en-IN")}
- Current cart: ${context.cart.length === 0 ? "empty" : `\n${cartLines}`}`;
}

// The reply for a place_order call is never trusted to the model's own words —
// small/free models sometimes narrate "Done — ordered!" without ever calling
// the tool, or call it but skip the confirmation text. Since this is the one
// tool that moves real money, whenever it actually ran we override whatever
// the model said with a message built deterministically from the tool result.
function describeOrderResult(orderResult: ReturnType<typeof executePlaceOrder> | null): string | null {
  if (!orderResult) return null;
  if (orderResult.ok) {
    const etaText = typeof orderResult.eta_minutes === "number" ? `, arriving in about ${orderResult.eta_minutes} minutes` : "";
    return `Done — ordered for ₹${orderResult.total.toLocaleString("en-IN")}${etaText}. You can track it in Activity.`;
  }
  if (orderResult.reason === "insufficient_balance") {
    return `Your wallet has ₹${orderResult.walletBalance.toLocaleString("en-IN")}, which isn't enough for the ₹${orderResult.total.toLocaleString(
      "en-IN"
    )} total — add ₹${orderResult.shortfall.toLocaleString("en-IN")} more from the Payments tab and I can place it right away.`;
  }
  if (orderResult.reason === "empty_cart") {
    return "Your cart's empty — tell me what you'd like and I'll add it first.";
  }
  return null;
}

type AsUserAssistant = ChatMessage & { role: "user" | "assistant" };
const isUserOrAssistant = (m: ChatMessage): m is AsUserAssistant => m.role === "user" || m.role === "assistant";
const isTerminalTool = (name: string) => name === "present_recommendations" || name === "place_order";

interface ToolRunResult {
  result: unknown;
  cart: CartItem[];
}

function runToolByName(name: string, input: Record<string, unknown>, cart: CartItem[], walletBalance: number): ToolRunResult {
  if (name === "search_catalog") return { result: executeSearch(input as Parameters<typeof executeSearch>[0]), cart };
  if (name === "get_item") return { result: executeGetItem((input as { item_id: string }).item_id), cart };
  if (name === "present_recommendations") return { result: { acknowledged: true }, cart };
  if (name === "add_to_cart") {
    const { cart: next, summary } = executeAddToCart(cart, input as { item_id: string; qty?: number });
    return { result: { cart: summary }, cart: next };
  }
  if (name === "remove_from_cart") {
    const { cart: next, summary } = executeRemoveFromCart(cart, input as { item_id: string });
    return { result: { cart: summary }, cart: next };
  }
  if (name === "place_order") return { result: executePlaceOrder(cart, walletBalance), cart };
  return { result: { error: `Unknown tool ${name}` }, cart };
}

async function runAnthropic(
  messages: ChatMessage[],
  apiKey: string,
  context: { walletBalance: number; cart: CartItem[]; displayName?: string }
) {
  const client = new Anthropic({ apiKey });

  const anthropicMessages: Anthropic.MessageParam[] = messages
    .filter(isUserOrAssistant)
    .map((m) => ({ role: m.role, content: m.content }));

  let recommendedIds: string[] = [];
  let finalText = "";
  let cart = context.cart;
  let orderResult: ReturnType<typeof executePlaceOrder> | null = null;

  // Bounded tool loop: search/get_item/cart mutations are safe to auto-run;
  // present_recommendations and place_order are terminal. Cap iterations so
  // a misbehaving model can't loop forever against our own API.
  for (let turn = 0; turn < 6; turn++) {
    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      system: buildSystemPrompt({ ...context, cart }),
      tools: AI_TOOLS as unknown as Anthropic.Tool[],
      messages: anthropicMessages,
    });

    const textBlocks = response.content.filter((b) => b.type === "text") as Anthropic.TextBlock[];
    finalText = textBlocks.map((b) => b.text).join("\n").trim();

    const toolUseBlocks = response.content.filter((b) => b.type === "tool_use") as Anthropic.ToolUseBlock[];
    if (toolUseBlocks.length === 0) break;

    const terminalCall = toolUseBlocks.find((b) => isTerminalTool(b.name));
    anthropicMessages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = toolUseBlocks.map((call) => {
      const { result, cart: nextCart } = runToolByName(call.name, call.input as Record<string, unknown>, cart, context.walletBalance);
      cart = nextCart;
      if (call.name === "present_recommendations") {
        const input = call.input as { item_ids: string[]; reasoning: string };
        recommendedIds = input.item_ids;
        finalText = finalText || input.reasoning;
      }
      if (call.name === "place_order") orderResult = result as ReturnType<typeof executePlaceOrder>;
      return { type: "tool_result", tool_use_id: call.id, content: JSON.stringify(result) };
    });

    anthropicMessages.push({ role: "user", content: toolResults });
    if (terminalCall) break;
  }

  finalText = describeOrderResult(orderResult) ?? finalText;
  return { reply: finalText || "Here's what I found.", itemIds: recommendedIds, mode: "claude" as const, cart, orderResult };
}

const GEMINI_TOOLS: FunctionDeclaration[] = AI_TOOLS.map((t) => ({
  name: t.name,
  description: t.description,
  parametersJsonSchema: t.input_schema,
}));

async function runGemini(
  messages: ChatMessage[],
  apiKey: string,
  context: { walletBalance: number; cart: CartItem[]; displayName?: string }
) {
  const ai = new GoogleGenAI({ apiKey });

  const contents: GeminiContent[] = messages
    .filter(isUserOrAssistant)
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));

  let recommendedIds: string[] = [];
  let finalText = "";
  let cart = context.cart;
  let orderResult: ReturnType<typeof executePlaceOrder> | null = null;

  for (let turn = 0; turn < 6; turn++) {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction: buildSystemPrompt({ ...context, cart }),
        tools: [{ functionDeclarations: GEMINI_TOOLS }],
      },
    });

    const text = response.text?.trim();
    if (text) finalText = text;

    const calls = response.functionCalls ?? [];
    if (calls.length === 0) break;

    const terminalCall = calls.find((c) => isTerminalTool(c.name ?? ""));

    const modelContent = response.candidates?.[0]?.content;
    if (modelContent) contents.push(modelContent);

    const responseParts = calls.map((call) => {
      const args = (call.args ?? {}) as Record<string, unknown>;
      const { result, cart: nextCart } = runToolByName(call.name ?? "", args, cart, context.walletBalance);
      cart = nextCart;
      if (call.name === "present_recommendations") {
        const input = args as { item_ids: string[]; reasoning: string };
        recommendedIds = input.item_ids;
        finalText = finalText || input.reasoning;
      }
      if (call.name === "place_order") orderResult = result as ReturnType<typeof executePlaceOrder>;
      return { functionResponse: { id: call.id, name: call.name, response: { output: result } } };
    });

    contents.push({ role: "user", parts: responseParts });
    if (terminalCall) break;
  }

  finalText = describeOrderResult(orderResult) ?? finalText;
  return { reply: finalText || "Here's what I found.", itemIds: recommendedIds, mode: "gemini" as const, cart, orderResult };
}

// OpenRouter free-tier models come and go and get rate-limited fast — don't
// pin to one. Tried in order per turn; on failure (rate limit, model
// temporarily down, etc.) we just move to the next candidate.
const OPENROUTER_MODELS = [
  "google/gemma-4-26b-a4b-it:free",
  "google/gemma-4-31b-it:free",
  "z-ai/glm-5.2:free",
  "minimax/minimax-m3:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
];

const OPENAI_TOOLS = AI_TOOLS.map((t) => ({
  type: "function" as const,
  function: { name: t.name, description: t.description, parameters: t.input_schema },
}));

interface OpenRouterToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}
interface OpenRouterMessage {
  role: string;
  content: string | null;
  tool_calls?: OpenRouterToolCall[];
  tool_call_id?: string;
}
interface OpenRouterResponse {
  choices?: { message?: { role: string; content: string | null; tool_calls?: OpenRouterToolCall[] } }[];
  error?: unknown;
}

async function callOpenRouter(apiKey: string, model: string, messages: OpenRouterMessage[]): Promise<OpenRouterResponse> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://pocket-concierge.local",
      "X-Title": "Pocket Concierge",
    },
    body: JSON.stringify({ model, messages, tools: OPENAI_TOOLS, tool_choice: "auto" }),
  });
  const data = (await res.json()) as OpenRouterResponse;
  if (!res.ok || data.error) {
    throw new Error(`OpenRouter ${model} failed: ${res.status} ${JSON.stringify(data.error ?? data)}`);
  }
  return data;
}

async function runOpenRouter(
  messages: ChatMessage[],
  apiKey: string,
  context: { walletBalance: number; cart: CartItem[]; displayName?: string }
) {
  let cart = context.cart;
  let recommendedIds: string[] = [];
  let finalText = "";
  let orderResult: ReturnType<typeof executePlaceOrder> | null = null;

  const orMessages: OpenRouterMessage[] = [
    { role: "system", content: buildSystemPrompt({ ...context, cart }) },
    ...messages.filter(isUserOrAssistant).map((m) => ({ role: m.role, content: m.content })),
  ];

  let modelIndex = 0;

  for (let turn = 0; turn < 6; turn++) {
    orMessages[0] = { role: "system", content: buildSystemPrompt({ ...context, cart }) };

    let data: OpenRouterResponse | null = null;
    let lastErr: unknown = null;
    for (; modelIndex < OPENROUTER_MODELS.length; modelIndex++) {
      try {
        data = await callOpenRouter(apiKey, OPENROUTER_MODELS[modelIndex], orMessages);
        break;
      } catch (err) {
        lastErr = err;
        console.error(`[ai/chat] openrouter model ${OPENROUTER_MODELS[modelIndex]} failed, trying next:`, err);
      }
    }
    if (!data) throw lastErr ?? new Error("All OpenRouter models failed");

    const message = data.choices?.[0]?.message;
    if (!message) break;
    if (message.content) finalText = message.content.trim();

    const toolCalls = message.tool_calls ?? [];
    if (toolCalls.length === 0) break;

    const terminalCall = toolCalls.find((c) => isTerminalTool(c.function.name));
    orMessages.push({ role: "assistant", content: message.content ?? null, tool_calls: toolCalls });

    for (const call of toolCalls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        // malformed tool-call arguments from a small free model — treat as empty input
      }
      const { result, cart: nextCart } = runToolByName(call.function.name, args, cart, context.walletBalance);
      cart = nextCart;
      if (call.function.name === "present_recommendations") {
        const input = args as { item_ids: string[]; reasoning: string };
        recommendedIds = input.item_ids;
        finalText = finalText || input.reasoning;
      }
      if (call.function.name === "place_order") orderResult = result as ReturnType<typeof executePlaceOrder>;
      orMessages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
    }

    if (terminalCall) break;
  }

  finalText = describeOrderResult(orderResult) ?? finalText;
  return { reply: finalText || "Here's what I found.", itemIds: recommendedIds, mode: "openrouter" as const, cart, orderResult };
}

export async function POST(req: NextRequest) {
  const { messages, context } = (await req.json()) as {
    messages: ChatMessage[];
    context?: { walletBalance?: number; cart?: CartItem[]; displayName?: string };
  };

  const normalizedContext = {
    walletBalance: context?.walletBalance ?? 0,
    cart: context?.cart ?? [],
    displayName: context?.displayName,
  };

  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;

  try {
    // Gemini first — that's the provider being tested right now.
    if (geminiKey) return NextResponse.json(await runGemini(messages, geminiKey, normalizedContext));
    if (anthropicKey) return NextResponse.json(await runAnthropic(messages, anthropicKey, normalizedContext));
    if (openrouterKey) return NextResponse.json(await runOpenRouter(messages, openrouterKey, normalizedContext));
  } catch (err) {
    console.error("[ai/chat] provider call failed, falling back:", err);
  }

  const fallback = runFallbackAgent(messages);
  return NextResponse.json({
    reply: fallback.reply,
    itemIds: fallback.itemIds,
    mode: "fallback" as const,
    cart: normalizedContext.cart,
    orderResult: null,
  });
}
