import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { byCategory } from "@/lib/data/catalog";
import { CATEGORY_META } from "@/lib/data/categories";
import { CATEGORY_ICON } from "@/lib/data/categoryIcons";
import ItemCard from "@/components/ItemCard";

// Food, Grocery, Hotels and Rides have their own dedicated flows
// (app/explore/food, app/explore/grocery, app/explore/hotels,
// app/explore/rides) — Next resolves those static routes before this
// dynamic one for those exact paths, but they're excluded here too so
// this page's own static generation doesn't pre-render for them.
const DEDICATED_CATEGORIES = new Set(["food", "grocery", "hotels", "rides"]);

export function generateStaticParams() {
  return CATEGORY_META.filter((c) => !DEDICATED_CATEGORIES.has(c.id)).map((c) => ({ category: c.id }));
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  if (DEDICATED_CATEGORIES.has(category)) notFound();
  const meta = CATEGORY_META.find((c) => c.id === category);
  if (!meta) notFound();

  const items = byCategory(meta.id);
  const Icon = CATEGORY_ICON[meta.id];

  return (
    <div className="px-5 pt-6">
      <Link href="/explore" className="inline-flex items-center gap-1 text-sm text-ink/50 hover:text-ink">
        <ChevronLeft size={16} /> Explore
      </Link>
      <h1 className="mt-2 inline-flex items-center gap-2 text-2xl font-semibold text-ink">
        <Icon size={22} className="text-accentDark" strokeWidth={1.8} /> {meta.label}
      </h1>

      <div className="mt-4 space-y-3 pb-6">
        {items.length === 0 ? (
          <p className="text-sm text-ink/40">No listings yet in this category.</p>
        ) : (
          items.map((item) => <ItemCard key={item.id} item={item} />)
        )}
      </div>
    </div>
  );
}
