import { CATALOG } from "@/lib/data/catalog";
import { CatalogItem, ChatMessage } from "@/lib/types";

// Zero-config demo agent used when neither GEMINI_API_KEY nor
// ANTHROPIC_API_KEY is set, so the app is fully interactive out of the box.
// It's deliberately simple keyword matching + scoring, not a real planner —
// the real path is route.ts's Gemini/Claude tool-use loop.

interface FallbackResult {
  reply: string;
  itemIds: string[];
}

const CATEGORY_KEYWORDS: { category: CatalogItem["category"]; words: string[] }[] = [
  { category: "electronics", words: ["laptop", "notebook", "computer", "pc"] },
  { category: "food", words: ["food", "eat", "hungry", "restaurant", "pizza", "curry", "lunch", "dinner"] },
  { category: "grocery", words: ["grocery", "groceries", "milk", "vegetable", "fruit"] },
  { category: "fashion", words: ["shirt", "jacket", "clothes", "wear", "fashion"] },
  { category: "hotels", words: ["hotel", "stay", "room", "resort"] },
  { category: "rides", words: ["ride", "cab", "taxi", "drop", "pickup"] },
  { category: "services", words: ["clean", "cleaning", "electrician", "repair", "plumber"] },
];

function extractBudget(text: string): number | undefined {
  const match = text.match(/(?:under|budget(?: of| is| around)?|around|₹|rs\.?)\s*([\d,]{3,7})/i);
  if (match) return Number(match[1].replace(/,/g, ""));
  const bare = text.match(/\b(\d{4,6})\b/);
  return bare ? Number(bare[1]) : undefined;
}

export function runFallbackAgent(messages: ChatMessage[]): FallbackResult {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const text = (lastUser?.content ?? "").toLowerCase();

  const matched = CATEGORY_KEYWORDS.find((c) => c.words.some((w) => text.includes(w)));
  const budget = extractBudget(text);

  if (!matched) {
    return {
      reply:
        "I can help with laptops, food, groceries, fashion, hotels, rides or home services — tell me what you're trying to get done and any must-haves (budget, timing, preferences), and I'll find good options.",
      itemIds: [],
    };
  }

  let candidates = CATALOG.filter((c) => c.category === matched.category);
  if (budget) candidates = candidates.filter((c) => c.price <= budget * 1.05);
  candidates = candidates.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.price - b.price);

  if (candidates.length === 0) {
    return {
      reply: `I couldn't find anything in ${matched.category} within that budget. Want me to widen the range?`,
      itemIds: [],
    };
  }

  const top = candidates.slice(0, 3);
  const budgetNote = budget ? ` within your ~₹${budget.toLocaleString("en-IN")} budget` : "";
  const reasonBits = top
    .map((c) => `**${c.title}** (₹${c.price.toLocaleString("en-IN")}, ${c.rating ?? "—"}★) — ${c.subtitle ?? ""}`)
    .join("\n");

  return {
    reply: `Here's what I'd point you to${budgetNote}, best fit first:\n\n${reasonBits}\n\nNo AI provider is reachable right now (check your API keys / provider quota) — this is the zero-config demo mode.`,
    itemIds: top.map((c) => c.id),
  };
}
