"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Star, Clock, MapPin } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { CatalogItem, Restaurant } from "@/lib/types";
import MenuItemRow from "@/components/MenuItemRow";

export default function RestaurantMenuView({ restaurant, items }: { restaurant: Restaurant; items: CatalogItem[] }) {
  const [switchBanner, setSwitchBanner] = useState(false);

  const sections = Array.from(new Set(items.map((i) => i.menuSection ?? "Menu")));

  function handleRestaurantSwitch() {
    setSwitchBanner(true);
    window.setTimeout(() => setSwitchBanner(false), 4000);
  }

  return (
    <div className="pb-28">
      <div
        className="relative flex h-32 w-full items-start p-4"
        style={{ background: `linear-gradient(135deg, ${restaurant.gradientFrom}, ${restaurant.gradientTo})` }}
      >
        <Link
          href="/explore/food"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur transition hover:bg-white/30"
        >
          <ChevronLeft size={18} />
        </Link>
      </div>

      <AnimatePresence>
        {switchBanner && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden bg-amber-50 px-5 text-xs text-amber-800"
          >
            <p className="py-2">Started a fresh order from {restaurant.name} — items from your previous restaurant were cleared.</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-5 pt-4">
        <h1 className="text-xl font-semibold text-ink">{restaurant.name}</h1>
        <p className="mt-0.5 text-sm text-ink/50">{restaurant.cuisines.join(", ")}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink/60">
          <span className="inline-flex items-center gap-1 rounded bg-emerald-600 px-1.5 py-0.5 font-bold text-white">
            <Star size={10} className="fill-white" /> {restaurant.rating}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock size={12} /> {restaurant.deliveryEtaMinutes} min
          </span>
          <span className="inline-flex items-center gap-1">
            <MapPin size={12} /> {restaurant.area}
          </span>
          <span>₹{restaurant.priceForTwo} for two</span>
        </div>
        {restaurant.offer && (
          <p className="mt-2 inline-block rounded-full bg-accentSoft px-3 py-1 text-xs font-semibold text-accentDark">{restaurant.offer}</p>
        )}
      </div>

      <div className="mt-3 px-5">
        {sections.map((section) => (
          <div key={section} className="mb-1">
            <h2 className="mb-1 pt-3 text-sm font-bold text-ink">{section}</h2>
            <div>
              {items
                .filter((i) => (i.menuSection ?? "Menu") === section)
                .map((item) => (
                  <MenuItemRow key={item.id} item={item} onRestaurantSwitch={handleRestaurantSwitch} />
                ))}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
