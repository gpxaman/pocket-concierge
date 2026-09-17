import Anthropic from "@anthropic-ai/sdk";
import { AI_TOOLS } from "@/lib/ai/tools";
import { buildSystemPrompt, RequestContext } from "@/lib/ai/systemPrompt";
import { finalizeReply } from "@/lib/ai/grounding";
import { AiChatSSEEvent, ChatMessage } from "@/lib/types";
import {
  extractBase64,
  freshToolOutcomeState,
  isTerminalTool,
  isUserOrAssistant,
  PendingImageInput,
  recordToolOutcome,
  runToolByName,
} from "./shared";

export async function runAnthropic(
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

  let finalText = "";
  let cart = context.cart;
  const state = freshToolOutcomeState();

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
      const { result, cart: nextCart } = runToolByName(call.name, call.input as Record<string, unknown>, cart, context.walletBalance, state.lastHotelPreview);
      cart = nextCart;
      const reasoningFallback = recordToolOutcome(state, call.name, call.input as Record<string, unknown>, result);
      if (reasoningFallback) finalText = finalText || reasoningFallback;
      return { type: "tool_result", tool_use_id: call.id, content: JSON.stringify(result) };
    });

    anthropicMessages.push({ role: "user", content: toolResults });
    if (terminalCall) break;
  }

  finalText = finalizeReply(finalText, cart, context.cart, state.orderResult, state.hotelBooking);
  // Safe to treat as "already spoken" only if turn 0 actually streamed text
  // and was never retracted — retracted staying false means no tool_use
  // block ever appeared, so finalizeReply structurally could not have
  // overridden anything above.
  const spoken = streamedAnyText && !retracted;
  return {
    reply: finalText || "Here's what I found.",
    itemIds: state.recommendedIds,
    mode: "claude" as const,
    cart,
    orderResult: state.orderResult,
    hotelBooking: state.hotelBooking,
    spoken,
  };
}
