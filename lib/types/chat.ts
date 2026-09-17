// The AI concierge's own in-app conversation turn shape, plus the SSE wire
// protocol between app/api/ai/chat/route.ts and HomeAgent.tsx. Distinct
// from lib/store/useChatStore's E2E direct-message types (ChatMessageE2E) —
// this is the assistant conversation, that's person-to-person messaging.

import type { CartItem } from "./transactions";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  itemIds?: string[];
  mode?: "claude" | "gemini" | "openrouter" | "fallback";
  createdAt: number;
  /** An image attached to this turn (base64 data URL), shown as a thumbnail in the transcript. */
  imageDataUrl?: string;
}

/**
 * Server->client events over the AI chat SSE stream. Only Anthropic/Gemini's
 * turn-0 (before any tool call) emits `speech_delta` — this is the ONLY case
 * structurally guaranteed safe to speak live, since finalizeReply's
 * money-moving-tool override can never apply when zero tools ran. Any tool
 * call anywhere in the request means a `retract` (if streaming had started)
 * followed eventually by `done` with the authoritative, fully-verified text.
 */
export type AiChatSSEEvent =
  | { type: "speech_delta"; text: string }
  | { type: "retract" }
  | {
      type: "done";
      /** true = the client already spoke this live via speech_delta chunks and must not speak `reply` again. */
      spoken: boolean;
      reply: string;
      itemIds: string[];
      mode: string;
      cart: CartItem[];
      orderResult: Record<string, unknown> | null;
      hotelBooking: Record<string, unknown> | null;
    };
