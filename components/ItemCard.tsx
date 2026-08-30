"use client";

import Link from "next/link";
import { CatalogItem, Transaction } from "@/lib/types";
import { useAppStore } from "@/lib/store/useAppStore";
import { useState } from "react";
import { Star, Clock, MapPin, Check, ArrowRight } from "lucide-react";
import { CATEGORY_ICON } from "@/lib/data/categoryIcons";

function txTypeFor(category: CatalogItem["category"]): Transaction["type"] {
  if (category === "hotels") return "BOOKING";
  if (category === "rides") return "RIDE";
  return "ORDER";
}

// Rides and food have their own real booking/checkout flow with live
// tracking (app/explore/rides, app/explore/food) — a plain "draft" here
// would just be an orphaned Transaction the user has to go hunt down in
// Activity to pay for. Hand off to the real flow instead.
const CHECKOUT_ROUTE: Partial<Record<CatalogItem["category"], string>> = {
  rides: "/explore/rides",
  food: "/explore/food",
};

export default function ItemCard({
  item,
  compact = false,
  mode = "draft",
}: {
  item: CatalogItem;
  compact?: boolean;
  /** "draft" (default): the Explore-tab flow — creates a draft transaction, authorized later in Activity.
   *  "cart": the AI-agent flow — adds to the working cart the concierge checks out from. */
  mode?: "draft" | "cart";
}) {
  const createDraft = useAppStore((s) => s.createDraft);
  const addToCart = useAppStore((s) => s.addToCart);
  const [added, setAdded] = useState(false);

  const checkoutRoute = CHECKOUT_ROUTE[item.category];
  const actionLabel =
    mode === "cart"
      ? "Add to cart"
      : item.category === "hotels"
        ? "Draft booking"
        : item.category === "rides"
          ? "Draft ride"
          : "Add to draft";
  const Icon = CATEGORY_ICON[item.category];

  return (
    <div className="flex gap-3 rounded-xl2 border border-black/5 bg-white p-3 shadow-sm">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-accentSoft text-accentDark">
        <Icon size={22} strokeWidth={1.7} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{item.title}</p>
            <p className="truncate text-xs text-ink/50">{item.providerName}{item.subtitle ? ` · ${item.subtitle}` : ""}</p>
          </div>
          <p className="shrink-0 text-sm font-semibold text-ink">₹{item.price.toLocaleString("en-IN")}</p>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-ink/50">
          {item.rating && (
            <span className="inline-flex items-center gap-0.5">
              <Star size={11} className="fill-amber-400 text-amber-400" /> {item.rating}
            </span>
          )}
          {typeof item.etaMinutes === "number" && (
            <span className="inline-flex items-center gap-0.5">
              <Clock size={11} /> {item.etaMinutes} min
            </span>
          )}
          {item.location && (
            <span className="inline-flex items-center gap-0.5">
              <MapPin size={11} /> {item.location}
            </span>
          )}
        </div>

        {!compact && (
          checkoutRoute ? (
            <Link
              href={checkoutRoute}
              className="mt-2 inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-ink transition hover:brightness-95"
            >
              {item.category === "rides" ? "Book a ride" : "Order food"} <ArrowRight size={13} />
            </Link>
          ) : (
            <button
              onClick={() => {
                if (mode === "cart") addToCart(item.id, 1);
                else createDraft(item, txTypeFor(item.category));
                setAdded(true);
                setTimeout(() => setAdded(false), 1800);
              }}
              className="mt-2 inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-ink transition hover:brightness-95"
            >
              {added ? (
                <>
                  <Check size={13} /> Added — no charge yet
                </>
              ) : (
                actionLabel
              )}
            </button>
          )
        )}
      </div>
    </div>
  );
}
