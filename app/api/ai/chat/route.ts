import { NextRequest } from "next/server";
import { executeBookHotel, executePlaceOrder } from "@/lib/ai/tools";
import { runFallbackAgent } from "@/lib/ai/fallback";
import { runAnthropic } from "@/lib/ai/providers/anthropic";
import { runGemini } from "@/lib/ai/providers/gemini";
import { runOpenRouter } from "@/lib/ai/providers/openrouter";
import { PendingImageInput } from "@/lib/ai/providers/shared";
import { RequestContext } from "@/lib/ai/systemPrompt";
import { AiChatSSEEvent, CartItem, ChatMessage } from "@/lib/types";

/** Formats one Server-Sent Event line. Every provider path funnels through this — see POST. */
function sseLine(event: AiChatSSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export const runtime = "nodejs";

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
