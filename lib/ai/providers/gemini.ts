import { GoogleGenAI, Content as GeminiContent, FunctionCall, FunctionDeclaration } from "@google/genai";
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

const GEMINI_TOOLS: FunctionDeclaration[] = AI_TOOLS.map((t) => ({
  name: t.name,
  description: t.description,
  parametersJsonSchema: t.input_schema,
}));

export async function runGemini(
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

  let finalText = "";
  let cart = context.cart;
  const state = freshToolOutcomeState();

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
      const { result, cart: nextCart } = runToolByName(call.name ?? "", args, cart, context.walletBalance, state.lastHotelPreview);
      cart = nextCart;
      const reasoningFallback = recordToolOutcome(state, call.name ?? "", args, result);
      if (reasoningFallback) finalText = finalText || reasoningFallback;
      return { functionResponse: { id: call.id, name: call.name, response: { output: result } } };
    });

    contents.push({ role: "user", parts: responseParts });
    if (terminalCall) break;
  }

  finalText = finalizeReply(finalText, cart, context.cart, state.orderResult, state.hotelBooking);
  const spoken = streamedAnyText && !retracted;
  return {
    reply: finalText || "Here's what I found.",
    itemIds: state.recommendedIds,
    mode: "gemini" as const,
    cart,
    orderResult: state.orderResult,
    hotelBooking: state.hotelBooking,
    spoken,
  };
}
