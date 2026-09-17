import {
  executeAddToCart,
  executeBookHotel,
  executeGetItem,
  executePlaceOrder,
  executePreviewHotelBooking,
  executeRemoveFromCart,
  executeSearch,
  HotelBookingPreview,
} from "@/lib/ai/tools";
import { CartItem, ChatMessage } from "@/lib/types";

export type AsUserAssistant = ChatMessage & { role: "user" | "assistant" };
export const isUserOrAssistant = (m: ChatMessage): m is AsUserAssistant => m.role === "user" || m.role === "assistant";
export const isTerminalTool = (name: string) => name === "present_recommendations" || name === "place_order" || name === "book_hotel";

// A model that answers a clear action request with plain text and zero tool
// calls is exactly the failure mode that slips past finalizeReply (nothing
// changed, so there's no grounded state to fall back to) — it just invents a
// confirmation. This is a coarse heuristic (only used to decide whether a
// no-tool-call response is worth retrying on a different model), not a
// substitute for the LLM's own judgment elsewhere.
const ACTION_INTENT_RE =
  /\b(add|remove|delete|order|buy|purchase|checkout|book|reserve|place it|place the order|do it|go ahead|yes|confirm(ed)?)\b/i;
export function expectsToolAction(lastUserText: string): boolean {
  return ACTION_INTENT_RE.test(lastUserText);
}

export interface ToolRunResult {
  result: unknown;
  cart: CartItem[];
}

export function runToolByName(
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

export interface PendingImageInput {
  dataUrl: string;
  mimeType: string;
}

/** Splits a "data:image/png;base64,AAAA..." URL into its mime type and raw base64 payload. */
export function extractBase64(dataUrl: string): { mimeType: string; data: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

// Every provider loop runs the same per-tool-call bookkeeping (previously
// copy-pasted verbatim into all three provider functions, once per
// provider): stash a successful hotel preview so book_hotel can trust it
// over the model's own args, capture present_recommendations' item ids (and
// its reasoning as a text fallback), and record the terminal place_order /
// book_hotel result for finalizeReply to ground the final reply against.
export interface ToolOutcomeState {
  recommendedIds: string[];
  orderResult: ReturnType<typeof executePlaceOrder> | null;
  hotelBooking: ReturnType<typeof executeBookHotel> | null;
  lastHotelPreview: HotelBookingPreview | null;
}

export function freshToolOutcomeState(): ToolOutcomeState {
  return { recommendedIds: [], orderResult: null, hotelBooking: null, lastHotelPreview: null };
}

/** Returns present_recommendations' reasoning text when that's the tool that just ran, else null. */
export function recordToolOutcome(state: ToolOutcomeState, name: string, args: Record<string, unknown>, result: unknown): string | null {
  if (name === "preview_hotel_booking" && result && !("error" in (result as object))) {
    state.lastHotelPreview = result as HotelBookingPreview;
  }
  if (name === "present_recommendations") {
    const input = args as { item_ids: string[]; reasoning: string };
    state.recommendedIds = input.item_ids;
    return input.reasoning;
  }
  if (name === "place_order") state.orderResult = result as ReturnType<typeof executePlaceOrder>;
  if (name === "book_hotel") state.hotelBooking = result as ReturnType<typeof executeBookHotel>;
  return null;
}
