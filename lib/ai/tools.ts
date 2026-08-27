import { CATALOG, findById } from "@/lib/data/catalog";
import { CatalogItem, ServiceCategory } from "@/lib/types";

// Typed, read-only tool contracts (TRD §8.3). The concierge may search,
// inspect and compare freely (PRD §8: "Search / Compare / Recommendation:
// no confirmation"). It never receives a tool that writes state directly —
// create_order/create_booking/request_ride are client-initiated actions
// gated by an explicit confirm step (see components/ConfirmSheet.tsx),
// which is what "authorization enforced outside the model" (TRD §8.5)
// looks like in a client-only demo.

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
      "Terminal tool. Call this once you have enough information and have grounded your choice in search_catalog/get_item results. Presents the recommended item(s) to the user with plain-language reasoning and trade-offs, per the concierge's decision-engine principles.",
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
    const q = input.query.toLowerCase();
    results = results.filter((c) => {
      const hay = [c.title, c.subtitle ?? "", c.providerName, JSON.stringify(c.attributes)].join(" ").toLowerCase();
      return q.split(/\s+/).some((term) => term.length > 2 && hay.includes(term));
    });
  }
  return results.slice(0, 8).map(trim);
}

export function executeGetItem(itemId: string) {
  const item = findById(itemId);
  return item ? trim(item) : { error: `No item with id ${itemId}` };
}
