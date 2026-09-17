// Barrel: the combined product catalog plus its lookup/mutation helpers.
// Every existing `import { CATALOG, findById, ... } from "@/lib/data/catalog"`
// across the app keeps working unchanged — the per-category files
// (electronics.ts, food.ts, ...) exist purely to keep one 1200-line array
// from being the first thing anyone has to scroll past to find a helper.
import { CartItem, CatalogItem } from "@/lib/types";
import { ELECTRONICS_ITEMS } from "./electronics";
import { FOOD_ITEMS } from "./food";
import { GROCERY_ITEMS } from "./grocery";
import { FASHION_ITEMS } from "./fashion";
import { HOTEL_ROOM_ITEMS } from "./hotels";
import { SERVICE_ITEMS } from "./services";

export const CATALOG: CatalogItem[] = [
  ...ELECTRONICS_ITEMS,
  ...FOOD_ITEMS,
  ...GROCERY_ITEMS,
  ...FASHION_ITEMS,
  ...HOTEL_ROOM_ITEMS,
  ...SERVICE_ITEMS,
];

export function findById(id: string): CatalogItem | undefined {
  return CATALOG.find((c) => c.id === id);
}

export function byCategory(category: string): CatalogItem[] {
  return CATALOG.filter((c) => c.category === category);
}

export function menuByRestaurant(restaurantId: string): CatalogItem[] {
  return CATALOG.filter((c) => c.category === "food" && c.providerId === restaurantId);
}

export function groceryByCategory(groceryCategoryId: string): CatalogItem[] {
  return CATALOG.filter((c) => c.category === "grocery" && c.groceryCategoryId === groceryCategoryId);
}

export function roomsByHotel(hotelId: string): CatalogItem[] {
  return CATALOG.filter((c) => c.category === "hotels" && c.providerId === hotelId).sort((a, b) => a.price - b.price);
}

/**
 * Adds an item to the cart, applying the single-restaurant rule real food
 * delivery apps use: adding a food item from a different restaurant than
 * what's already in the cart replaces those items (everything else in the
 * cart, e.g. grocery, is left untouched). Shared by the manual Explore flow
 * (useAppStore.addToCart) and the AI agent (executeAddToCart) so the rule
 * applies the same way regardless of how the item was added.
 */
export function cartWithItemAdded(cart: CartItem[], itemId: string, qty: number): { cart: CartItem[]; restaurantSwitched: boolean } {
  const item = findById(itemId);
  if (!item) return { cart, restaurantSwitched: false };

  let base = cart;
  let restaurantSwitched = false;
  if (item.category === "food") {
    const hasOtherRestaurant = cart.some((c) => {
      const existing = findById(c.itemId);
      return existing?.category === "food" && existing.providerId !== item.providerId;
    });
    if (hasOtherRestaurant) {
      base = cart.filter((c) => findById(c.itemId)?.category !== "food");
      restaurantSwitched = true;
    }
  }

  const existingLine = base.find((c) => c.itemId === itemId);
  const nextCart = existingLine
    ? base.map((c) => (c.itemId === itemId ? { ...c, qty: c.qty + qty } : c))
    : [...base, { itemId, qty }];
  return { cart: nextCart, restaurantSwitched };
}
