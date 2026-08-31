import { CartItem } from "@/lib/types";
import { findById } from "@/lib/data/catalog";
import { RideType } from "@/lib/data/rideTypes";

export interface PriceBreakdown {
  itemTotal: number;
  deliveryFee: number;
  platformFee: number;
  gst: number;
  total: number;
}

// Single source of truth for what a cart actually costs — used by the
// manual checkout page's bill summary AND both order-placement paths
// (useAppStore.placeOrderFromCart, lib/ai/tools.ts's executePlaceOrder), so
// what the user is shown before confirming is exactly what gets charged
// regardless of whether they checked out manually or via the AI agent.
// Thresholds/fees are mocked but modeled on real Zomato/Blinkit patterns
// (free delivery above a spend threshold, flat platform fee, GST on items).
export function priceCart(cart: CartItem[]): PriceBreakdown {
  const lines = cart
    .map((c) => ({ item: findById(c.itemId), qty: c.qty }))
    .filter((l): l is { item: NonNullable<typeof l.item>; qty: number } => Boolean(l.item));

  const itemTotal = lines.reduce((sum, l) => sum + l.item.price * l.qty, 0);
  if (itemTotal === 0) return { itemTotal: 0, deliveryFee: 0, platformFee: 0, gst: 0, total: 0 };

  const isFood = lines.some((l) => l.item.category === "food");
  const freeDeliveryThreshold = isFood ? 149 : 99;
  const deliveryFee = itemTotal >= freeDeliveryThreshold ? 0 : isFood ? 25 : 15;
  const platformFee = 5;
  const gst = Math.round(itemTotal * 0.05);

  return { itemTotal, deliveryFee, platformFee, gst, total: itemTotal + deliveryFee + platformFee + gst };
}

export interface StayPriceBreakdown {
  nights: number;
  roomTotal: number;
  taxesAndFees: number;
  total: number;
}

/** Nights between two YYYY-MM-DD dates, clamped to at least 1. */
export function nightsBetween(checkIn: string, checkOut: string): number {
  const inMs = new Date(`${checkIn}T00:00:00`).getTime();
  const outMs = new Date(`${checkOut}T00:00:00`).getTime();
  if (!Number.isFinite(inMs) || !Number.isFinite(outMs)) return 1;
  return Math.max(1, Math.round((outMs - inMs) / 86_400_000));
}

// Same reasoning as priceCart: one place that computes what a stay actually
// costs, used by both the booking checkout page's bill summary and
// useAppStore.bookHotel's real charge, so they can't drift apart. Taxes and
// fees are mocked (~12%, roughly matching typical Indian hotel GST) rather
// than Booking.com's real per-property fee rules — this is a prototype.
export function priceStay(pricePerNight: number, nights: number): StayPriceBreakdown {
  const roomTotal = pricePerNight * nights;
  const taxesAndFees = Math.round(roomTotal * 0.12);
  return { nights, roomTotal, taxesAndFees, total: roomTotal + taxesAndFees };
}

export interface RidePriceBreakdown {
  baseFare: number;
  distanceFare: number;
  total: number;
}

// Same discipline again: one function computing what a ride actually costs,
// used by the request panel's fare estimate, the completion screen's bill
// summary, and useAppStore.completeRide's real charge.
export function priceRide(rideType: RideType, distanceKm: number): RidePriceBreakdown {
  const distanceFare = Math.round(rideType.perKm * distanceKm);
  return { baseFare: rideType.baseFare, distanceFare, total: rideType.baseFare + distanceFare };
}
