import Link from "next/link";
import { Star, Clock, Leaf } from "lucide-react";
import { Restaurant } from "@/lib/types";

export default function RestaurantCard({ restaurant }: { restaurant: Restaurant }) {
  return (
    <Link
      href={`/explore/food/${restaurant.id}`}
      className="block overflow-hidden rounded-xl2 border border-black/5 bg-white shadow-sm transition hover:border-accentDark/40"
    >
      <div
        className="relative flex h-28 w-full items-end p-3"
        style={{ background: `linear-gradient(135deg, ${restaurant.gradientFrom}, ${restaurant.gradientTo})` }}
      >
        {restaurant.isPureVeg && (
          <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded bg-white/90">
            <Leaf size={11} className="text-emerald-600" />
          </span>
        )}
        {restaurant.offer && (
          <span className="rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-bold text-ink shadow-sm">{restaurant.offer}</span>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-semibold text-ink">{restaurant.name}</p>
          <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-emerald-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
            <Star size={10} className="fill-white" /> {restaurant.rating}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs text-ink/50">{restaurant.cuisines.join(", ")}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-ink/50">
          <span className="inline-flex items-center gap-0.5">
            <Clock size={11} /> {restaurant.deliveryEtaMinutes} min
          </span>
          <span>·</span>
          <span>₹{restaurant.priceForTwo} for two</span>
          <span>·</span>
          <span className="truncate">{restaurant.area}</span>
        </div>
      </div>
    </Link>
  );
}
