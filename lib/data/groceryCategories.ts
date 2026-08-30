import { Carrot, Milk, Cookie, CupSoda, Sparkles, SprayCan, LucideIcon } from "lucide-react";
import { GroceryCategoryMeta } from "@/lib/types";

// Blinkit-style shelves — a handful of high-frequency categories rather
// than a deep taxonomy, matching the quick-commerce "under ~2,000 SKUs"
// model researched (see the plan's UX grounding notes).
export const GROCERY_CATEGORIES: GroceryCategoryMeta[] = [
  { id: "fruits-veg", label: "Fruits & Vegetables" },
  { id: "dairy-breakfast", label: "Dairy & Breakfast" },
  { id: "snacks", label: "Snacks & Munchies" },
  { id: "beverages", label: "Cold Drinks & Juices" },
  { id: "personal-care", label: "Personal Care" },
  { id: "household", label: "Household Essentials" },
];

export const GROCERY_CATEGORY_ICON: Record<string, LucideIcon> = {
  "fruits-veg": Carrot,
  "dairy-breakfast": Milk,
  snacks: Cookie,
  beverages: CupSoda,
  "personal-care": Sparkles,
  household: SprayCan,
};

export function findGroceryCategory(id: string): GroceryCategoryMeta | undefined {
  return GROCERY_CATEGORIES.find((c) => c.id === id);
}
