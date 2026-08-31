import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { GROCERY_CATEGORIES, GROCERY_CATEGORY_ICON, findGroceryCategory } from "@/lib/data/groceryCategories";
import { groceryByCategory } from "@/lib/data/catalog";
import ProductCard from "@/components/ProductCard";

export function generateStaticParams() {
  return GROCERY_CATEGORIES.map((c) => ({ category: c.id }));
}

export default async function GroceryCategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const meta = findGroceryCategory(category);
  if (!meta) notFound();
  const Icon = GROCERY_CATEGORY_ICON[category];
  const items = groceryByCategory(category);

  return (
    <div className="px-5 pt-6 pb-28">
      <Link href="/explore/grocery" className="inline-flex items-center gap-1 text-sm text-ink/50 hover:text-ink">
        <ChevronLeft size={16} /> Groceries
      </Link>
      <h1 className="mt-2 inline-flex items-center gap-2 text-2xl font-semibold text-ink">
        <Icon size={22} className="text-accentDark" strokeWidth={1.8} /> {meta.label}
      </h1>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {items.length === 0 ? (
          <p className="col-span-2 py-8 text-center text-sm text-ink/40">No products in this category yet.</p>
        ) : (
          items.map((item) => <ProductCard key={item.id} item={item} />)
        )}
      </div>

    </div>
  );
}
