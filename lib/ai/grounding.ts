import { executeBookHotel, executePlaceOrder, describeCartState, describeHotelBookingResult } from "@/lib/ai/tools";
import { CartItem } from "@/lib/types";

// The reply for a place_order call is never trusted to the model's own words —
// small/free models sometimes narrate "Done — ordered!" without ever calling
// the tool, or call it but skip the confirmation text. Since this is the one
// tool that moves real money, whenever it actually ran we override whatever
// the model said with a message built deterministically from the tool result.
export function describeOrderResult(orderResult: ReturnType<typeof executePlaceOrder> | null): string | null {
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
export function finalizeReply(
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
