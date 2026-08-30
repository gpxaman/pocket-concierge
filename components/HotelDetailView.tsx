"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Star, MapPin, Users, Pencil } from "lucide-react";
import { CatalogItem, Hotel } from "@/lib/types";
import { reviewLabel } from "@/lib/data/hotels";
import { addDays, formatDateLabel, todayIso } from "@/lib/dates";
import { nightsBetween } from "@/lib/pricing";
import RoomRow from "@/components/RoomRow";

export default function HotelDetailView({ hotel, rooms }: { hotel: Hotel; rooms: CatalogItem[] }) {
  const searchParams = useSearchParams();
  const checkIn = searchParams.get("checkin") || addDays(todayIso(), 1);
  const checkOut = searchParams.get("checkout") || addDays(todayIso(), 2);
  const guestsParam = Number(searchParams.get("guests"));
  const guests = Number.isFinite(guestsParam) && guestsParam > 0 ? guestsParam : 2;

  const nights = nightsBetween(checkIn, checkOut);

  return (
    <div className="pb-10">
      <div
        className="relative flex h-32 w-full items-start p-4"
        style={{ background: `linear-gradient(135deg, ${hotel.gradientFrom}, ${hotel.gradientTo})` }}
      >
        <Link
          href="/explore/hotels"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur transition hover:bg-white/30"
        >
          <ChevronLeft size={18} />
        </Link>
      </div>

      <div className="px-5 pt-4">
        <h1 className="text-xl font-semibold text-ink">{hotel.name}</h1>
        <div className="mt-1 flex items-center gap-0.5">
          {Array.from({ length: hotel.starRating }).map((_, i) => (
            <Star key={i} size={12} className="fill-accent text-accent" />
          ))}
        </div>
        <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-ink/50">
          <MapPin size={12} /> {hotel.address}
        </p>

        <div className="mt-2 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded bg-emerald-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
            {hotel.reviewScore.toFixed(1)}
          </span>
          <span className="text-xs font-medium text-ink/70">{reviewLabel(hotel.reviewScore)}</span>
          <span className="text-xs text-ink/40">· {hotel.reviewCount.toLocaleString("en-IN")} reviews</span>
        </div>

        <p className="mt-3 text-sm text-ink/60">{hotel.description}</p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {hotel.amenities.map((a) => (
            <span key={a} className="rounded-full bg-accentSoft px-2.5 py-1 text-[11px] text-accentDark">
              {a}
            </span>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between rounded-xl2 border border-black/10 bg-white p-3 shadow-sm">
          <div className="text-sm text-ink/70">
            <p className="font-medium text-ink">
              {formatDateLabel(checkIn)} – {formatDateLabel(checkOut)} · {nights} night{nights > 1 ? "s" : ""}
            </p>
            <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-ink/45">
              <Users size={12} /> {guests} guest{guests > 1 ? "s" : ""}
            </p>
          </div>
          <Link href="/explore/hotels" className="inline-flex items-center gap-1 text-xs font-medium text-accentDark">
            <Pencil size={11} /> Edit
          </Link>
        </div>
      </div>

      <div className="mt-4 space-y-3 px-5">
        <h2 className="text-sm font-bold text-ink">Choose your room</h2>
        {rooms.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink/40">No rooms listed for this hotel yet.</p>
        ) : (
          rooms.map((room) => <RoomRow key={room.id} room={room} guests={guests} checkIn={checkIn} checkOut={checkOut} />)
        )}
      </div>
    </div>
  );
}
