import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI, Content as GeminiContent, FunctionDeclaration } from "@google/genai";
import {
  AI_TOOLS,
  describeCartState,
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

// Same reasoning as describeOrderResult: if the cart actually changed this
// turn, the grounded post-state always wins over whatever the model said,
// since a small model can narrate "removed it!" without the tool call
// landing (wrong item_id, no call made, etc).
function finalizeReply(finalText: string, cart: CartItem[], startingCart: CartItem[], orderResult: ReturnType<typeof executePlaceOrder> | null): string {
  const grounded = describeOrderResult(orderResult);
  if (grounded) return grounded;
  const cartMutated = JSON.stringify(cart) !== JSON.stringify(startingCart);
  return cartMutated ? describeCartState(cart) : finalText;
}

type AsUserAssistant = ChatMessage & { role: "user" | "assistant" };
const isUserOrAssistant = (m: ChatMessage): m is AsUserAssistant => m.role === "user" || m.role === "assistant";
const isTerminalTool = (name: string) => name === "present_recommendations" || name === "place_order";

// A model that answers a clear action request with plain text and zero tool
// calls is exactly the failure mode that slips past finalizeReply (nothing
// changed, so there's no grounded state to fall back to) — it just invents a
// confirmation. This is a coarse heuristic (only used to decide whether a
// no-tool-call response is worth retrying on a different model), not a
// substitute for the LLM's own judgment elsewhere.
const ACTION_INTENT_RE = /\b(add|remove|delete|order|buy|purchase|checkout|place it|place the order|do it|go ahead|yes|confirm(ed)?)\b/i;
function expectsToolAction(lastUserText: string): boolean {
  return ACTION_INTENT_RE.test(lastUserText);
}

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

  finalText = finalizeReply(finalText, cart, context.cart, orderResult);
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

  finalText = finalizeReply(finalText, cart, context.cart, orderResult);
  return { reply: finalText || "Here's what I found.", itemIds: recommendedIds, mode: "gemini" as const, cart, orderResult };
}

// OpenRouter free-tier models come and go and get rate-limited fast — don't
// pin to one. Tried in order per turn; on failure (rate limit, model
// temporarily down, etc.) we just move to the next candidate. This static
// list is a known-good baseline (curated for tool-calling support); it's
// merged with a live, cached fetch of whatever's currently free on
// OpenRouter so newly added free models get picked up automatically.
// Ordered for LOW LATENCY first (small/"flash"/"lightning"/"mini"-class
// models before large ones — this app is voice-first, so response speed
// matters more than squeezing out the last bit of quality), with the
// biggest, slowest models pushed to the end since they were also the ones
// observed hitting OpenRouter's shared free-tier daily cap first. The
// untrustworthy-no-tool-call retry below still catches a fast model that
// skips a required tool call, so speed-first ordering doesn't sacrifice
// correctness.
const OPENROUTER_STATIC_MODELS = [
  "nvidia/nemotron-3.5-lightning:free",
  "inclusionai/ling-3.0-flash-fin:free",
  "google/gemma-4-26b-a4b-it:free",
  "liquid/lfm-2.5-2.6b:free",
  "poolside/laguna-xs-2.1:free",
  "cohere/north-mini-code:free",
  "google/gemma-4-31b-it:free",
  "minimax/minimax-m2.7:free",
  "dots-studio/dots-3-note-preview:free",
  "poolside/laguna-s-2.1:free",
  "thinkingmachines/inkling:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "minimax/minimax-m3:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "z-ai/glm-5.2:free",
  "openrouter/free", // OpenRouter's own free-model auto-router — last resort catch-all
];

interface OpenRouterModelListing {
  id: string;
  pricing?: { prompt?: string; completion?: string };
  supported_parameters?: string[];
}

let modelListCache: { models: string[]; fetchedAt: number } | null = null;
const MODEL_LIST_TTL_MS = 20 * 60 * 1000;

async function getOpenRouterModelCandidates(apiKey: string): Promise<string[]> {
  const now = Date.now();
  if (modelListCache && now - modelListCache.fetchedAt < MODEL_LIST_TTL_MS) {
    return modelListCache.models;
  }
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`models list ${res.status}`);
    const data = (await res.json()) as { data?: OpenRouterModelListing[] };
    const free = (data.data ?? [])
      .filter(
        (m) =>
          m.pricing &&
          parseFloat(m.pricing.prompt ?? "1") === 0 &&
          parseFloat(m.pricing.completion ?? "1") === 0 &&
          (m.supported_parameters ?? []).includes("tools")
      )
      .map((m) => m.id);
    // Curated list first (known-quality, proven to work), then any other
    // currently-free tool-capable model we discovered, for extra redundancy.
    const merged = [...OPENROUTER_STATIC_MODELS, ...free.filter((id) => !OPENROUTER_STATIC_MODELS.includes(id))];
    modelListCache = { models: merged, fetchedAt: now };
    return merged;
  } catch (err) {
    console.error("[ai/chat] couldn't refresh OpenRouter free-model list, using static list:", err);
    return OPENROUTER_STATIC_MODELS;
  }
}

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

// Voice-first UX means a model that's merely slow (not erroring) is just as
// bad as one that's down — cap each candidate's turn so a laggy free model
// can't stall the whole reply; a timeout counts as a failure and moves to
// the next candidate in the rotation.
const OPENROUTER_MODEL_TIMEOUT_MS = 12_000;

async function callOpenRouter(apiKey: string, model: string, messages: OpenRouterMessage[]): Promise<OpenRouterResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPENROUTER_MODEL_TIMEOUT_MS);
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://pocket-concierge.local",
        "X-Title": "Pocket Concierge",
      },
      body: JSON.stringify({ model, messages, tools: OPENAI_TOOLS, tool_choice: "auto" }),
      signal: controller.signal,
    });
    const data = (await res.json()) as OpenRouterResponse;
    if (!res.ok || data.error) {
      throw new Error(`OpenRouter ${model} failed: ${res.status} ${JSON.stringify(data.error ?? data)}`);
    }
    return data;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`OpenRouter ${model} timed out after ${OPENROUTER_MODEL_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
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

  const models = await getOpenRouterModelCandidates(apiKey);
  let modelIndex = 0;

  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const actionExpected = expectsToolAction(lastUserMessage);
  // True only if every candidate model responded to an action request
  // without ever calling a tool — in that case we still need *a* response
  // object to read a request-id etc. from, but its text must never reach
  // the user (see the honest-refusal override after the loop).
  let untrustedActionResponse = false;

  for (let turn = 0; turn < 6; turn++) {
    orMessages[0] = { role: "system", content: buildSystemPrompt({ ...context, cart }) };

    let data: OpenRouterResponse | null = null;
    let lastHttpSuccess: OpenRouterResponse | null = null;
    let lastErr: unknown = null;
    for (; modelIndex < models.length; modelIndex++) {
      try {
        const candidate = await callOpenRouter(apiKey, models[modelIndex], orMessages);
        lastHttpSuccess = candidate;
        // On the very first turn of an action request, a response with zero
        // tool calls is untrustworthy — the model is likely narrating an
        // action it never performed. Treat it like a failure and try the
        // next model instead of accepting fabricated text.
        if (turn === 0 && actionExpected && (candidate.choices?.[0]?.message?.tool_calls ?? []).length === 0) {
          console.error(`[ai/chat] openrouter model ${models[modelIndex]} answered an action request with no tool calls, trying next model`);
          continue;
        }
        data = candidate;
        break;
      } catch (err) {
        lastErr = err;
        console.error(`[ai/chat] openrouter model ${models[modelIndex]} failed, trying next:`, err);
      }
    }
    if (!data && lastHttpSuccess) {
      // Every model responded but none actually called a tool for this
      // action — don't trust any of their text.
      console.error("[ai/chat] no OpenRouter model used a tool for this action request; refusing to trust any of their text");
      data = lastHttpSuccess;
      untrustedActionResponse = true;
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

  finalText = untrustedActionResponse
    ? "Sorry, I couldn't complete that just now — could you try again?"
    : finalizeReply(finalText, cart, context.cart, orderResult);
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

  // Each configured provider gets its own try: a failure (quota exhausted,
  // outage, bad key) falls through to the next one immediately rather than
  // jumping straight to the zero-config demo fallback. Order is a rough
  // quality ranking — first provider with a usable response wins.
  type ProviderResult = {
    reply: string;
    itemIds: string[];
    mode: string;
    cart: CartItem[];
    orderResult: ReturnType<typeof executePlaceOrder> | null;
  };
  const attempts: { name: string; run: () => Promise<ProviderResult> }[] = [];
  if (geminiKey) attempts.push({ name: "Gemini", run: () => runGemini(messages, geminiKey, normalizedContext) });
  if (anthropicKey) attempts.push({ name: "Anthropic", run: () => runAnthropic(messages, anthropicKey, normalizedContext) });
  if (openrouterKey) attempts.push({ name: "OpenRouter", run: () => runOpenRouter(messages, openrouterKey, normalizedContext) });

  for (const attempt of attempts) {
    try {
      return NextResponse.json(await attempt.run());
    } catch (err) {
      console.error(`[ai/chat] ${attempt.name} failed, trying next provider:`, err);
    }
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
