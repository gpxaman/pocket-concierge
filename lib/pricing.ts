import { CartItem } from "@/lib/types";
import { findById } from "@/lib/data/catalog";

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
