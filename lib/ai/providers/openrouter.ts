import { AI_TOOLS } from "@/lib/ai/tools";
import { buildSystemPrompt, RequestContext } from "@/lib/ai/systemPrompt";
import { finalizeReply } from "@/lib/ai/grounding";
import { ChatMessage } from "@/lib/types";
import { expectsToolAction, freshToolOutcomeState, isTerminalTool, isUserOrAssistant, PendingImageInput, recordToolOutcome, runToolByName } from "./shared";

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

export async function runOpenRouter(messages: ChatMessage[], apiKey: string, context: RequestContext, image?: PendingImageInput) {
  let cart = context.cart;
  let finalText = "";
  const state = freshToolOutcomeState();

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
      const { result, cart: nextCart } = runToolByName(call.function.name, args, cart, context.walletBalance, state.lastHotelPreview);
      cart = nextCart;
      const reasoningFallback = recordToolOutcome(state, call.function.name, args, result);
      if (reasoningFallback) finalText = finalText || reasoningFallback;
      orMessages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
    }

    if (terminalCall) break;
  }

  finalText = untrustedActionResponse
    ? "Sorry, I couldn't complete that just now — could you try again?"
    : finalizeReply(finalText, cart, context.cart, state.orderResult, state.hotelBooking);
  // OpenRouter never streams (no SDK, hand-rolled candidate-retry logic that
  // needs a complete response before it can decide whether to trust it) —
  // always the non-streamed, fully-verified path.
  return {
    reply: finalText || "Here's what I found.",
    itemIds: state.recommendedIds,
    mode: "openrouter" as const,
    cart,
    orderResult: state.orderResult,
    hotelBooking: state.hotelBooking,
    spoken: false,
  };
}
