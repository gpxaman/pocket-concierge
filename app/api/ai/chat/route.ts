import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI, Content as GeminiContent, FunctionCall, FunctionDeclaration } from "@google/genai";
import {
  AI_TOOLS,
  describeCartState,
  describeHotelBookingResult,
  executeAddToCart,
  executeBookHotel,
  executeGetItem,
  executePlaceOrder,
  executePreviewHotelBooking,
  executeRemoveFromCart,
  executeSearch,
  HotelBookingPreview,
} from "@/lib/ai/tools";
import { runFallbackAgent } from "@/lib/ai/fallback";
import { AiChatSSEEvent, CartItem, ChatMessage } from "@/lib/types";
import { findById } from "@/lib/data/catalog";

/** Formats one Server-Sent Event line. Every provider path funnels through this — see POST. */
function sseLine(event: AiChatSSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export const runtime = "nodejs";

interface RequestContext {
  walletBalance: number;
  cart: CartItem[];
  displayName?: string;
  /** Today's date (YYYY-MM-DD) from the client's own clock/timezone — never computed server-side,
   *  since a server's local date can legitimately differ from the user's (see lib/dates.ts). */
  today?: string;
}

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
- Food carts hold items from one restaurant at a time (like Zomato/DoorDash). If add_to_cart returns
  restaurant_switched: true, it means adding this item cleared out a different restaurant's items already in
  the cart — mention that briefly so the user isn't surprised, don't just stay silent about it.
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
- Hotels work differently from the cart: use search_catalog (category "hotels") to find rooms, then ALWAYS
  call preview_hotel_booking with the room id, check-in/check-out dates and guest count before quoting a price
  — never compute or guess a hotel total yourself. Resolve relative dates ("tomorrow", "this weekend", "3
  nights from Friday") against today's date given below. State the room, dates, nights and total, then wait
  for explicit confirmation on a later turn — same confirmation rule as place_order.
- CRITICAL for hotels: on the turn the user confirms, call preview_hotel_booking again FIRST with the exact
  same item_id/check_in/check_out/guests, THEN call book_hotel — every single time, even though you already
  previewed it earlier. The earlier preview was a different request and this model does not reliably recall
  the exact item_id string across turns; re-previewing in the same turn as the booking is what makes sure the
  right room actually gets booked. Never call book_hotel without a preview_hotel_booking call earlier in that
  same turn.
- Keep replies tight: 1-4 sentences, spoken-voice style. Plain prose only — no markdown bullet/numbered lists
  or headings (the client renders **bold** but nothing else literally).
- If the user attaches an image, actually look at it and respond to what's in it — describe it, answer
  questions about it, or use it to help find/compare a real catalog item if that's what they're asking for.`;

function buildSystemPrompt(context: RequestContext) {
  const cartLines = context.cart
    .map((c) => {
      const item = findById(c.itemId);
      return item ? `- ${item.title} (${item.providerName}) x${c.qty} — ₹${item.price * c.qty}` : null;
    })
    .filter(Boolean)
    .join("\n");

  return `${BASE_SYSTEM_PROMPT}

Live account state (authoritative — trust this over anything said earlier in the conversation):
- Today's date: ${context.today || "unknown — ask the user to confirm a date if they use a relative one like \"tomorrow\""}
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
function finalizeReply(
  finalText: string,
  cart: CartItem[],
  startingCart: CartItem[],
  orderResult: ReturnType<typeof executePlaceOrder> | null,
  hotelBooking: ReturnType<typeof executeBookHotel> | null
): string {
  const groundedHotel = describeHotelBookingResult(hotelBooking);
  if (groundedHotel) return groundedHotel;
  const grounded = describeOrderResult(orderResult);
  if (grounded) return grounded;
  const cartMutated = JSON.stringify(cart) !== JSON.stringify(startingCart);
  return cartMutated ? describeCartState(cart) : finalText;
}

type AsUserAssistant = ChatMessage & { role: "user" | "assistant" };
const isUserOrAssistant = (m: ChatMessage): m is AsUserAssistant => m.role === "user" || m.role === "assistant";
const isTerminalTool = (name: string) => name === "present_recommendations" || name === "place_order" || name === "book_hotel";

// A model that answers a clear action request with plain text and zero tool
// calls is exactly the failure mode that slips past finalizeReply (nothing
// changed, so there's no grounded state to fall back to) — it just invents a
// confirmation. This is a coarse heuristic (only used to decide whether a
// no-tool-call response is worth retrying on a different model), not a
// substitute for the LLM's own judgment elsewhere.
const ACTION_INTENT_RE =
  /\b(add|remove|delete|order|buy|purchase|checkout|book|reserve|place it|place the order|do it|go ahead|yes|confirm(ed)?)\b/i;
function expectsToolAction(lastUserText: string): boolean {
  return ACTION_INTENT_RE.test(lastUserText);
}

interface ToolRunResult {
  result: unknown;
  cart: CartItem[];
}

function runToolByName(
  name: string,
  input: Record<string, unknown>,
  cart: CartItem[],
  walletBalance: number,
  lastHotelPreview: HotelBookingPreview | null
): ToolRunResult {
  if (name === "search_catalog") return { result: executeSearch(input as Parameters<typeof executeSearch>[0]), cart };
  if (name === "get_item") return { result: executeGetItem((input as { item_id: string }).item_id), cart };
  if (name === "present_recommendations") return { result: { acknowledged: true }, cart };
  if (name === "add_to_cart") {
    const { cart: next, summary, restaurant_switched } = executeAddToCart(cart, input as { item_id: string; qty?: number });
    return { result: { cart: summary, restaurant_switched }, cart: next };
  }
  if (name === "remove_from_cart") {
    const { cart: next, summary } = executeRemoveFromCart(cart, input as { item_id: string });
    return { result: { cart: summary }, cart: next };
  }
  if (name === "place_order") return { result: executePlaceOrder(cart, walletBalance), cart };
  if (name === "preview_hotel_booking" || name === "book_hotel") {
    const hotelInput = input as unknown as { item_id: string; check_in: string; check_out: string; guests: number };
    if (name === "preview_hotel_booking") return { result: executePreviewHotelBooking(hotelInput), cart };
    // Prefer the last successfully-previewed booking from THIS turn over
    // whatever the model itself passed to book_hotel — small models
    // sometimes mistype or invent an item_id on the confirmation call even
    // right after a correct preview_hotel_booking call.
    const effectiveInput = lastHotelPreview
      ? {
          item_id: lastHotelPreview.item_id,
          check_in: lastHotelPreview.check_in,
          check_out: lastHotelPreview.check_out,
          guests: lastHotelPreview.guests,
        }
      : hotelInput;
    return { result: executeBookHotel(effectiveInput, walletBalance), cart };
  }
  return { result: { error: `Unknown tool ${name}` }, cart };
}

interface PendingImageInput {
  dataUrl: string;
  mimeType: string;
}

/** Splits a "data:image/png;base64,AAAA..." URL into its mime type and raw base64 payload. */
function extractBase64(dataUrl: string): { mimeType: string; data: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

async function runAnthropic(
  messages: ChatMessage[],
  apiKey: string,
  context: RequestContext,
  image: PendingImageInput | undefined,
  emit: (evt: AiChatSSEEvent) => void
) {
  const client = new Anthropic({ apiKey });

  const anthropicMessages: Anthropic.MessageParam[] = messages
    .filter(isUserOrAssistant)
    .map((m) => ({ role: m.role, content: m.content }));

  // Only the current turn's image is attached, not replayed into every
  // history entry — keeps request payloads sane on later turns.
  if (image) {
    const parsed = extractBase64(image.dataUrl);
    const lastIdx = anthropicMessages.length - 1;
    if (parsed && lastIdx >= 0 && anthropicMessages[lastIdx].role === "user") {
      const text = anthropicMessages[lastIdx].content as string;
      anthropicMessages[lastIdx] = {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: parsed.mimeType as "image/png", data: parsed.data } },
          { type: "text", text },
        ],
      };
    }
  }

  let recommendedIds: string[] = [];
  let finalText = "";
  let cart = context.cart;
  let orderResult: ReturnType<typeof executePlaceOrder> | null = null;
  let hotelBooking: ReturnType<typeof executeBookHotel> | null = null;
  let lastHotelPreview: HotelBookingPreview | null = null;

  // Speculative streaming: only turn 0 streams live text to the client, and
  // only until (if ever) a tool_use block starts — at that point we retract
  // (the client stops/discards whatever was queued) and every later turn
  // reverts to a plain non-streaming call, exactly like before. This is
  // structurally safe because finalizeReply (below) can only override text
  // when a tool actually ran — if turn 0 never saw one, nothing downstream
  // can invalidate what was already spoken.
  let streamedAnyText = false;
  let retracted = false;

  // Bounded tool loop: search/get_item/cart mutations are safe to auto-run;
  // present_recommendations and place_order are terminal. Cap iterations so
  // a misbehaving model can't loop forever against our own API.
  for (let turn = 0; turn < 6; turn++) {
    let response: Anthropic.Message;
    if (turn === 0) {
      const stream = client.messages.stream({
        model: "claude-sonnet-5",
        max_tokens: 1024,
        system: buildSystemPrompt({ ...context, cart }),
        tools: AI_TOOLS as unknown as Anthropic.Tool[],
        messages: anthropicMessages,
      });
      stream.on("text", (delta) => {
        if (retracted) return;
        streamedAnyText = true;
        emit({ type: "speech_delta", text: delta });
      });
      stream.on("streamEvent", (event) => {
        if (!retracted && event.type === "content_block_start" && event.content_block.type === "tool_use") {
          retracted = true;
          emit({ type: "retract" });
        }
      });
      response = await stream.finalMessage();
    } else {
      response = await client.messages.create({
        model: "claude-sonnet-5",
        max_tokens: 1024,
        system: buildSystemPrompt({ ...context, cart }),
        tools: AI_TOOLS as unknown as Anthropic.Tool[],
        messages: anthropicMessages,
      });
    }

    const textBlocks = response.content.filter((b) => b.type === "text") as Anthropic.TextBlock[];
    finalText = textBlocks.map((b) => b.text).join("\n").trim();

    const toolUseBlocks = response.content.filter((b) => b.type === "tool_use") as Anthropic.ToolUseBlock[];
    if (toolUseBlocks.length === 0) break;

    const terminalCall = toolUseBlocks.find((b) => isTerminalTool(b.name));
    anthropicMessages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = toolUseBlocks.map((call) => {
      const { result, cart: nextCart } = runToolByName(call.name, call.input as Record<string, unknown>, cart, context.walletBalance, lastHotelPreview);
      cart = nextCart;
      if (call.name === "preview_hotel_booking" && result && !("error" in (result as object))) {
        lastHotelPreview = result as HotelBookingPreview;
      }
      if (call.name === "present_recommendations") {
        const input = call.input as { item_ids: string[]; reasoning: string };
        recommendedIds = input.item_ids;
        finalText = finalText || input.reasoning;
      }
      if (call.name === "place_order") orderResult = result as ReturnType<typeof executePlaceOrder>;
      if (call.name === "book_hotel") hotelBooking = result as ReturnType<typeof executeBookHotel>;
      return { type: "tool_result", tool_use_id: call.id, content: JSON.stringify(result) };
    });

    anthropicMessages.push({ role: "user", content: toolResults });
    if (terminalCall) break;
  }

  finalText = finalizeReply(finalText, cart, context.cart, orderResult, hotelBooking);
  // Safe to treat as "already spoken" only if turn 0 actually streamed text
  // and was never retracted — retracted staying false means no tool_use
  // block ever appeared, so finalizeReply structurally could not have
  // overridden anything above.
  const spoken = streamedAnyText && !retracted;
  return { reply: finalText || "Here's what I found.", itemIds: recommendedIds, mode: "claude" as const, cart, orderResult, hotelBooking, spoken };
}

const GEMINI_TOOLS: FunctionDeclaration[] = AI_TOOLS.map((t) => ({
  name: t.name,
  description: t.description,
  parametersJsonSchema: t.input_schema,
}));

async function runGemini(
  messages: ChatMessage[],
  apiKey: string,
  context: RequestContext,
  image: PendingImageInput | undefined,
  emit: (evt: AiChatSSEEvent) => void
) {
  const ai = new GoogleGenAI({ apiKey });

  const contents: GeminiContent[] = messages
    .filter(isUserOrAssistant)
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));

  if (image) {
    const parsed = extractBase64(image.dataUrl);
    const lastIdx = contents.length - 1;
    if (parsed && lastIdx >= 0 && contents[lastIdx].role === "user") {
      const text = (contents[lastIdx].parts?.[0] as { text?: string } | undefined)?.text ?? "";
      contents[lastIdx] = {
        role: "user",
        parts: [{ inlineData: { mimeType: parsed.mimeType, data: parsed.data } }, { text }],
      };
    }
  }

  let recommendedIds: string[] = [];
  let finalText = "";
  let cart = context.cart;
  let orderResult: ReturnType<typeof executePlaceOrder> | null = null;
  let hotelBooking: ReturnType<typeof executeBookHotel> | null = null;
  let lastHotelPreview: HotelBookingPreview | null = null;

  // Same speculative-streaming contract as Anthropic — see the comment there.
  let streamedAnyText = false;
  let retracted = false;

  for (let turn = 0; turn < 6; turn++) {
    let text = "";
    let calls: FunctionCall[] = [];
    let modelContent: GeminiContent | undefined;

    if (turn === 0) {
      const stream = await ai.models.generateContentStream({
        model: "gemini-2.5-flash",
        contents,
        config: {
          systemInstruction: buildSystemPrompt({ ...context, cart }),
          tools: [{ functionDeclarations: GEMINI_TOOLS }],
        },
      });
      // Each yielded chunk is a DELTA (its own new parts, not a cumulative
      // snapshot) — accumulate parts in arrival order so `modelContent`
      // ends up identical in shape to what the non-streaming call below
      // would have produced, for the tool round-trip history.
      const accumulatedParts: NonNullable<GeminiContent["parts"]> = [];
      for await (const chunk of stream) {
        const chunkParts = chunk.candidates?.[0]?.content?.parts ?? [];
        for (const part of chunkParts) {
          accumulatedParts.push(part);
          if (part.text) {
            text += part.text;
            if (!retracted) {
              streamedAnyText = true;
              emit({ type: "speech_delta", text: part.text });
            }
          }
          if (part.functionCall) {
            calls.push(part.functionCall);
            if (!retracted) {
              retracted = true;
              emit({ type: "retract" });
            }
          }
        }
      }
      if (accumulatedParts.length > 0) modelContent = { role: "model", parts: accumulatedParts };
    } else {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents,
        config: {
          systemInstruction: buildSystemPrompt({ ...context, cart }),
          tools: [{ functionDeclarations: GEMINI_TOOLS }],
        },
      });
      text = response.text?.trim() ?? "";
      calls = response.functionCalls ?? [];
      modelContent = response.candidates?.[0]?.content;
    }

    if (text.trim()) finalText = text.trim();
    if (calls.length === 0) break;

    const terminalCall = calls.find((c) => isTerminalTool(c.name ?? ""));
    if (modelContent) contents.push(modelContent);

    const responseParts = calls.map((call) => {
      const args = (call.args ?? {}) as Record<string, unknown>;
      const { result, cart: nextCart } = runToolByName(call.name ?? "", args, cart, context.walletBalance, lastHotelPreview);
      cart = nextCart;
      if (call.name === "preview_hotel_booking" && result && !("error" in (result as object))) {
        lastHotelPreview = result as HotelBookingPreview;
      }
      if (call.name === "present_recommendations") {
        const input = args as { item_ids: string[]; reasoning: string };
        recommendedIds = input.item_ids;
        finalText = finalText || input.reasoning;
      }
      if (call.name === "place_order") orderResult = result as ReturnType<typeof executePlaceOrder>;
      if (call.name === "book_hotel") hotelBooking = result as ReturnType<typeof executeBookHotel>;
      return { functionResponse: { id: call.id, name: call.name, response: { output: result } } };
    });

    contents.push({ role: "user", parts: responseParts });
    if (terminalCall) break;
  }

  finalText = finalizeReply(finalText, cart, context.cart, orderResult, hotelBooking);
  const spoken = streamedAnyText && !retracted;
  return { reply: finalText || "Here's what I found.", itemIds: recommendedIds, mode: "gemini" as const, cart, orderResult, hotelBooking, spoken };
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
  architecture?: { input_modalities?: string[] };
}

let modelListCache: { freeModels: OpenRouterModelListing[]; fetchedAt: number } | null = null;
const MODEL_LIST_TTL_MS = 20 * 60 * 1000;

async function getOpenRouterModelCandidates(apiKey: string, requireImage = false): Promise<string[]> {
  const now = Date.now();
  let freeModels: OpenRouterModelListing[];
  if (modelListCache && now - modelListCache.fetchedAt < MODEL_LIST_TTL_MS) {
    freeModels = modelListCache.freeModels;
  } else {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) throw new Error(`models list ${res.status}`);
      const data = (await res.json()) as { data?: OpenRouterModelListing[] };
      freeModels = (data.data ?? []).filter(
        (m) =>
          m.pricing &&
          parseFloat(m.pricing.prompt ?? "1") === 0 &&
          parseFloat(m.pricing.completion ?? "1") === 0 &&
          (m.supported_parameters ?? []).includes("tools")
      );
      modelListCache = { freeModels, fetchedAt: now };
    } catch (err) {
      console.error("[ai/chat] couldn't refresh OpenRouter free-model list, using static list:", err);
      freeModels = [];
    }
  }

  const freeIds = freeModels.map((m) => m.id);
  // Curated list first (known-quality, proven to work), then any other
  // currently-free tool-capable model discovered, for extra redundancy.
  const merged = [...OPENROUTER_STATIC_MODELS, ...freeIds.filter((id) => !OPENROUTER_STATIC_MODELS.includes(id))];
  if (!requireImage) return merged;

  // With an image attached, put vision-capable free models first — the
  // static list is text-only-curated, so this only reorders the discovered set.
  const visionCapable = new Set(
    freeModels.filter((m) => (m.architecture?.input_modalities ?? []).includes("image")).map((m) => m.id)
  );
  return [...merged.filter((id) => visionCapable.has(id)), ...merged.filter((id) => !visionCapable.has(id))];
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
type OpenRouterContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
interface OpenRouterMessage {
  role: string;
  content: string | null | OpenRouterContentPart[];
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

async function runOpenRouter(messages: ChatMessage[], apiKey: string, context: RequestContext, image?: PendingImageInput) {
  let cart = context.cart;
  let recommendedIds: string[] = [];
  let finalText = "";
  let orderResult: ReturnType<typeof executePlaceOrder> | null = null;
  let hotelBooking: ReturnType<typeof executeBookHotel> | null = null;
  let lastHotelPreview: HotelBookingPreview | null = null;

  const orMessages: OpenRouterMessage[] = [
    { role: "system", content: buildSystemPrompt({ ...context, cart }) },
    ...messages.filter(isUserOrAssistant).map((m) => ({ role: m.role, content: m.content })),
  ];

  // OpenAI-format image content — unlike Anthropic/Gemini, image_url takes
  // the data URL directly, no need to strip the base64 prefix.
  if (image) {
    const lastIdx = orMessages.length - 1;
    if (lastIdx >= 0 && orMessages[lastIdx].role === "user") {
      const text = orMessages[lastIdx].content as string;
      orMessages[lastIdx] = {
        role: "user",
        content: [
          { type: "text", text },
          { type: "image_url", image_url: { url: image.dataUrl } },
        ],
      };
    }
  }

  const models = await getOpenRouterModelCandidates(apiKey, Boolean(image));
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
      const { result, cart: nextCart } = runToolByName(call.function.name, args, cart, context.walletBalance, lastHotelPreview);
      cart = nextCart;
      if (call.function.name === "preview_hotel_booking" && result && !("error" in (result as object))) {
        lastHotelPreview = result as HotelBookingPreview;
      }
      if (call.function.name === "present_recommendations") {
        const input = args as { item_ids: string[]; reasoning: string };
        recommendedIds = input.item_ids;
        finalText = finalText || input.reasoning;
      }
      if (call.function.name === "place_order") orderResult = result as ReturnType<typeof executePlaceOrder>;
      if (call.function.name === "book_hotel") hotelBooking = result as ReturnType<typeof executeBookHotel>;
      orMessages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
    }

    if (terminalCall) break;
  }

  finalText = untrustedActionResponse
    ? "Sorry, I couldn't complete that just now — could you try again?"
    : finalizeReply(finalText, cart, context.cart, orderResult, hotelBooking);
  // OpenRouter never streams (no SDK, hand-rolled candidate-retry logic that
  // needs a complete response before it can decide whether to trust it) —
  // always the non-streamed, fully-verified path.
  return { reply: finalText || "Here's what I found.", itemIds: recommendedIds, mode: "openrouter" as const, cart, orderResult, hotelBooking, spoken: false };
}

export async function POST(req: NextRequest) {
  const { messages, context, image } = (await req.json()) as {
    messages: ChatMessage[];
    context?: { walletBalance?: number; cart?: CartItem[]; displayName?: string; today?: string };
    image?: PendingImageInput;
  };

  const normalizedContext: RequestContext = {
    walletBalance: context?.walletBalance ?? 0,
    cart: context?.cart ?? [],
    displayName: context?.displayName,
    today: context?.today,
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
    hotelBooking: ReturnType<typeof executeBookHotel> | null;
    spoken: boolean;
  };

  // Single uniform SSE response for every path (streamed or not) — the
  // client always reads via the same SSE parser, never branches on which
  // provider answered. Only Gemini/Anthropic's turn-0 ever calls `enqueue`
  // with a `speech_delta`/`retract` before the final `done`; OpenRouter and
  // the local fallback go straight to one `done` event, unchanged in effect
  // from the plain-JSON response this replaced.
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let emittedAny = false;
      const enqueue = (evt: AiChatSSEEvent) => {
        if (evt.type === "speech_delta" || evt.type === "retract") emittedAny = true;
        controller.enqueue(encoder.encode(sseLine(evt)));
      };

      const attempts: { name: string; run: () => Promise<ProviderResult> }[] = [];
      if (geminiKey) attempts.push({ name: "Gemini", run: () => runGemini(messages, geminiKey, normalizedContext, image, enqueue) });
      if (anthropicKey) attempts.push({ name: "Anthropic", run: () => runAnthropic(messages, anthropicKey, normalizedContext, image, enqueue) });
      if (openrouterKey) attempts.push({ name: "OpenRouter", run: () => runOpenRouter(messages, openrouterKey, normalizedContext, image) });

      for (const attempt of attempts) {
        try {
          const result = await attempt.run();
          enqueue({
            type: "done",
            spoken: result.spoken,
            reply: result.reply,
            itemIds: result.itemIds,
            mode: result.mode,
            cart: result.cart,
            orderResult: result.orderResult,
            hotelBooking: result.hotelBooking,
          });
          controller.close();
          return;
        } catch (err) {
          console.error(`[ai/chat] ${attempt.name} failed, trying next provider:`, err);
          // This attempt may have already streamed some speech before
          // failing on a later turn — tell the client to discard it before
          // falling through to a different provider's answer.
          if (emittedAny) {
            enqueue({ type: "retract" });
            emittedAny = false;
          }
        }
      }

      const fallback = runFallbackAgent(messages);
      enqueue({
        type: "done",
        spoken: false,
        reply: fallback.reply,
        itemIds: fallback.itemIds,
        mode: "fallback",
        cart: normalizedContext.cart,
        orderResult: null,
        hotelBooking: null,
      });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
