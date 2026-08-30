import { CATALOG, findById } from "@/lib/data/catalog";
import { CartItem, CatalogItem, ServiceCategory } from "@/lib/types";

// Typed tool contracts (TRD §8.3). search_catalog/get_item are read-only —
// the concierge may search, inspect and compare freely (PRD §8: "Search /
// Compare / Recommendation: no confirmation"). add_to_cart/remove_from_cart
// mutate a working cart that is not yet paid for. place_order is the one
// tool that moves money: it is gated in the system prompt (route.ts) to
// require an explicit user confirmation turn first, which is what
// "authorization enforced outside the model" (TRD §8.5) looks like when the
// model itself drives checkout — the confirmation is the spoken/typed "yes,
// place it", logged to the audit trail exactly like a tapped Confirm button.

export const AI_TOOLS = [
  {
    name: "search_catalog",
    description:
      "Search the shared service catalog across all categories (electronics, food, grocery, fashion, hotels, rides, services). Returns matching items with price and key attributes. Use this before recommending anything — never invent items.",
    input_schema: {
      type: "object" as const,
      properties: {
        category: {
          type: "string",
          enum: ["electronics", "food", "grocery", "fashion", "hotels", "rides", "services"],
          description: "Restrict results to one category. Omit to search everything.",
        },
        query: {
          type: "string",
          description: "Free-text keywords to match against title/subtitle/attributes.",
        },
        max_price: { type: "number", description: "Upper price bound in INR." },
        min_rating: { type: "number", description: "Minimum rating (0-5)." },
      },
    },
  },
  {
    name: "get_item",
    description: "Fetch full details for a single catalog item by id.",
    input_schema: {
      type: "object" as const,
      properties: { item_id: { type: "string" } },
      required: ["item_id"],
    },
  },
  {
    name: "present_recommendations",
    description:
      "Terminal tool. Call this to show item options on the user's screen so they can see and compare them (e.g. several restaurants/products) — it does NOT add anything to the cart or spend any money. Ground every option in search_catalog/get_item results first.",
    input_schema: {
      type: "object" as const,
      properties: {
        item_ids: {
          type: "array",
          items: { type: "string" },
          description: "1-4 item ids from search_catalog/get_item results, best first.",
        },
        reasoning: {
          type: "string",
          description:
            "Plain-language explanation of why these fit the user's stated goal, including trade-offs. No jargon dumps.",
        },
      },
      required: ["item_ids", "reasoning"],
    },
  },
  {
    name: "add_to_cart",
    description:
      "Add an item (already found via search_catalog/get_item) to the user's working cart. Does not spend money — that only happens with place_order after the user confirms.",
    input_schema: {
      type: "object" as const,
      properties: {
        item_id: { type: "string" },
        qty: { type: "number", description: "Quantity, defaults to 1." },
      },
      required: ["item_id"],
    },
  },
  {
    name: "remove_from_cart",
    description: "Remove an item from the user's working cart.",
    input_schema: {
      type: "object" as const,
      properties: { item_id: { type: "string" } },
      required: ["item_id"],
    },
  },
  {
    name: "place_order",
    description:
      "Terminal tool. Charges the cart total to the user's wallet and places the order. Only call this after you have shown the user the cart contents and total price AND the user has explicitly confirmed in their latest message that they want to go ahead (e.g. 'yes', 'place it', 'do it', 'confirmed') — never call it speculatively or on the same turn you first proposed the order. If the wallet balance is insufficient this will fail and you must tell the user to top up instead of retrying.",
    input_schema: {
      type: "object" as const,
      properties: {
        confirm: { type: "boolean", description: "Must be true — restates that the user just confirmed." },
      },
      required: ["confirm"],
    },
  },
] as const;

export type ToolName = (typeof AI_TOOLS)[number]["name"];

function trim(item: CatalogItem) {
  return {
    id: item.id,
    category: item.category,
    provider: item.providerName,
    title: item.title,
    subtitle: item.subtitle,
    price: item.price,
    currency: item.currency,
    rating: item.rating,
    eta_minutes: item.etaMinutes,
    location: item.location,
    attributes: item.attributes,
  };
}

export function executeSearch(input: {
  category?: ServiceCategory;
  query?: string;
  max_price?: number;
  min_rating?: number;
}) {
  let results = CATALOG;
  if (input.category) results = results.filter((c) => c.category === input.category);
  if (typeof input.max_price === "number") results = results.filter((c) => c.price <= input.max_price!);
  if (typeof input.min_rating === "number") results = results.filter((c) => (c.rating ?? 0) >= input.min_rating!);

  if (input.query) {
    const terms = input.query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
    if (terms.length > 0) {
      const scored = results.map((c) => {
        const hay = [c.category, c.title, c.subtitle ?? "", c.providerName, JSON.stringify(c.attributes)]
          .join(" ")
          .toLowerCase();
        return { item: c, score: terms.filter((t) => hay.includes(t)).length };
      });
      const matched = scored.filter((s) => s.score > 0);
      // Free text is a ranking signal, not a hard filter: mock item copy ("Acer Aspire 7")
      // rarely contains the query's literal words ("laptop"), and dropping every structurally
      // correct match (right category/price/rating) just because of that would be wrong —
      // fall back to the full (already category/price/rating-filtered) set instead.
      results = (matched.length > 0 ? matched : scored).sort((a, b) => b.score - a.score).map((s) => s.item);
    }
  }

  return results.slice(0, 8).map(trim);
}

export function executeGetItem(itemId: string) {
  const item = findById(itemId);
  return item ? trim(item) : { error: `No item with id ${itemId}` };
}

function cartSummary(cart: CartItem[]) {
  return cart
    .map((c) => {
      const item = findById(c.itemId);
      return item ? { item_id: item.id, title: item.title, provider: item.providerName, qty: c.qty, price: item.price } : null;
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);
}

/** Mutates and returns a new cart array — callers keep the returned value as the running cart for the rest of the tool loop. */
export function executeAddToCart(cart: CartItem[], input: { item_id: string; qty?: number }): { cart: CartItem[]; summary: ReturnType<typeof cartSummary> } {
  const item = findById(input.item_id);
  if (!item) return { cart, summary: cartSummary(cart) };
  const qty = input.qty && input.qty > 0 ? input.qty : 1;
  const existing = cart.find((c) => c.itemId === input.item_id);
  const next = existing
    ? cart.map((c) => (c.itemId === input.item_id ? { ...c, qty: c.qty + qty } : c))
    : [...cart, { itemId: input.item_id, qty }];
  return { cart: next, summary: cartSummary(next) };
}

export function executeRemoveFromCart(cart: CartItem[], input: { item_id: string }): { cart: CartItem[]; summary: ReturnType<typeof cartSummary> } {
  const next = cart.filter((c) => c.itemId !== input.item_id);
  return { cart: next, summary: cartSummary(next) };
}

// Small/free models sometimes narrate a cart change ("Done, removed the
// Farmhouse!") without the underlying tool call actually landing (wrong
// item_id, no call made at all, etc.) — the client always renders the real
// `cart` array so nothing is ever financially wrong, but the spoken/typed
// reply can lie about it. Whenever a cart-mutating tool actually ran this
// turn, the caller replaces the model's text with this grounded summary
// instead of trusting its narration.
export function describeCartState(cart: CartItem[]): string {
  const summary = cartSummary(cart);
  if (summary.length === 0) return "Your cart is empty now.";
  const lines = summary.map((i) => `${i.qty > 1 ? `${i.qty}x ` : ""}${i.title} (${i.provider})`).join(", ");
  const total = summary.reduce((sum, i) => sum + i.price * i.qty, 0);
  return `Your cart now has: ${lines} — total ₹${total.toLocaleString("en-IN")}. Want me to place the order?`;
}

export function executePlaceOrder(cart: CartItem[], walletBalance: number) {
  const summary = cartSummary(cart);
  if (summary.length === 0) return { ok: false as const, reason: "empty_cart" as const };
  const total = summary.reduce((sum, i) => sum + i.price * i.qty, 0);
  if (walletBalance < total) {
    return { ok: false as const, reason: "insufficient_balance" as const, total, walletBalance, shortfall: total - walletBalance };
  }
  const catalogItems = cart.map((c) => findById(c.itemId)).filter((i): i is CatalogItem => Boolean(i));
  const etaCandidates = catalogItems.map((i) => i.etaMinutes).filter((n): n is number => typeof n === "number");
  const eta_minutes = etaCandidates.length > 0 ? Math.max(...etaCandidates) : undefined;
  return { ok: true as const, items: summary, total, eta_minutes };
}
