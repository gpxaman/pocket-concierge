"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Search, Sparkles } from "lucide-react";
import clsx from "clsx";
import { RESTAURANTS } from "@/lib/data/restaurants";
import RestaurantCard from "@/components/RestaurantCard";

const FILTERS = [
  { id: "rating", label: "Rating 4.0+" },
  { id: "veg", label: "Pure Veg" },
  { id: "fast", label: "Fast Delivery" },
] as const;

export default function FoodPage() {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const restaurants = useMemo(() => {
    return RESTAURANTS.filter((r) => {
      if (query && !`${r.name} ${r.cuisines.join(" ")}`.toLowerCase().includes(query.toLowerCase())) return false;
      if (active.has("rating") && r.rating < 4.0) return false;
      if (active.has("veg") && !r.isPureVeg) return false;
      if (active.has("fast") && r.deliveryEtaMinutes > 30) return false;
      return true;
    });
  }, [query, active]);

  return (
    <div className="px-5 pt-6 pb-28">
      <Link href="/explore" className="inline-flex items-center gap-1 text-sm text-ink/50 hover:text-ink">
        <ChevronLeft size={16} /> Explore
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-ink">Order food</h1>
      <p className="mt-1 text-sm text-ink/50">Restaurants delivering near you — same catalog the AI concierge uses.</p>

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
          placeholder="Search restaurants or cuisines"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink/35"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => toggle(f.id)}
            className={clsx(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition",
              active.has(f.id) ? "border-ink bg-ink text-white" : "border-black/15 text-ink/70 hover:border-ink/40"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {restaurants.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink/40">No restaurants match those filters.</p>
        ) : (
          restaurants.map((r) => <RestaurantCard key={r.id} restaurant={r} />)
        )}
      </div>

    </div>
  );
}
