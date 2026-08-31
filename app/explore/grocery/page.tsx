"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Search, Sparkles, Zap } from "lucide-react";
import { GROCERY_CATEGORIES, GROCERY_CATEGORY_ICON } from "@/lib/data/groceryCategories";
import { byCategory, groceryByCategory } from "@/lib/data/catalog";
import ProductCard from "@/components/ProductCard";

export default function GroceryPage() {
  const [query, setQuery] = useState("");

  const searchResults = useMemo(() => {
    if (!query.trim()) return null;
    const q = query.toLowerCase();
    return byCategory("grocery").filter((i) => i.title.toLowerCase().includes(q));
  }, [query]);

  return (
    <div className="px-5 pt-6 pb-28">
      <Link href="/explore" className="inline-flex items-center gap-1 text-sm text-ink/50 hover:text-ink">
        <ChevronLeft size={16} /> Explore
      </Link>

      <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        <Zap size={12} className="fill-emerald-700" /> Delivery in 10 minutes
      </div>
      <h1 className="mt-2 text-2xl font-semibold text-ink">Groceries</h1>
      <p className="mt-1 text-sm text-ink/50">Everyday essentials, delivered fast — same catalog the AI concierge uses.</p>

      <Link
        href="/"
        className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-accentSoft px-3 py-1.5 text-xs font-medium text-accentDark transition hover:brightness-95"
      >
        <Sparkles size={12} /> Prefer to just ask? Try the AI tab
      </Link>

      <div className="mt-4 flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-2 shadow-sm">
        <Search size={16} className="text-ink/35" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for milk, chips, shampoo…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink/35"
        />
      </div>

      {searchResults ? (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {searchResults.length === 0 ? (
            <p className="col-span-2 py-8 text-center text-sm text-ink/40">No products match &ldquo;{query}&rdquo;.</p>
          ) : (
            searchResults.map((item) => <ProductCard key={item.id} item={item} />)
          )}
        </div>
      ) : (
        <>
          <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
            {GROCERY_CATEGORIES.map((c) => {
              const Icon = GROCERY_CATEGORY_ICON[c.id];
              return (
                <Link
                  key={c.id}
                  href={`/explore/grocery/${c.id}`}
                  className="flex w-[76px] shrink-0 flex-col items-center gap-1.5 rounded-xl2 border border-black/5 bg-white px-2 py-2.5 shadow-sm transition hover:border-accentDark/40"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accentSoft text-accentDark">
                    <Icon size={18} strokeWidth={1.8} />
                  </span>
                  <span className="text-center text-[10px] font-medium leading-tight text-ink/70">{c.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="mt-5 space-y-6">
            {GROCERY_CATEGORIES.map((c) => {
              const items = groceryByCategory(c.id).slice(0, 4);
              if (items.length === 0) return null;
              return (
                <div key={c.id}>
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-ink">{c.label}</h2>
                    <Link href={`/explore/grocery/${c.id}`} className="text-xs font-medium text-accentDark">
                      See all
                    </Link>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    {items.map((item) => (
                      <ProductCard key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

    </div>
  );
}
