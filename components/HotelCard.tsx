import Link from "next/link";
import { Star } from "lucide-react";
import { Hotel } from "@/lib/types";
import { reviewLabel } from "@/lib/data/hotels";

export default function HotelCard({
  hotel,
  fromPrice,
  checkIn,
  checkOut,
  guests,
}: {
  hotel: Hotel;
  fromPrice: number;
  checkIn: string;
  checkOut: string;
  guests: number;
}) {
  const href = `/explore/hotels/${hotel.id}?checkin=${checkIn}&checkout=${checkOut}&guests=${guests}`;

  return (
    <Link
      href={href}
      className="block overflow-hidden rounded-xl2 border border-black/5 bg-white shadow-sm transition hover:border-accentDark/40"
    >
      <div className="h-28 w-full" style={{ background: `linear-gradient(135deg, ${hotel.gradientFrom}, ${hotel.gradientTo})` }} />
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{hotel.name}</p>
            <div className="mt-0.5 flex items-center gap-0.5">
              {Array.from({ length: hotel.starRating }).map((_, i) => (
                <Star key={i} size={11} className="fill-accent text-accent" />
              ))}
            </div>
            <p className="mt-0.5 text-xs text-ink/50">{hotel.area}</p>
          </div>
          <span className="flex shrink-0 flex-col items-end gap-0.5">
            <span className="inline-flex items-center gap-1 rounded bg-emerald-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
              {hotel.reviewScore.toFixed(1)}
            </span>
            <span className="text-[10px] text-ink/45">{reviewLabel(hotel.reviewScore)}</span>
          </span>
        </div>

        <div className="mt-2 flex flex-wrap gap-1">
          {hotel.amenities.slice(0, 3).map((a) => (
            <span key={a} className="rounded-full bg-accentSoft px-2 py-0.5 text-[10px] text-accentDark">
              {a}
            </span>
          ))}
        </div>

        <div className="mt-2 flex items-end justify-between">
          <p className="text-[11px] text-ink/40">{hotel.reviewCount.toLocaleString("en-IN")} reviews</p>
          <div className="text-right">
            <p className="text-[10px] text-ink/40">per night from</p>
            <p className="text-base font-bold text-ink">₹{fromPrice.toLocaleString("en-IN")}</p>
          </div>
        </div>
      </div>
    </Link>
  );
}
