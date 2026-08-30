"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Sparkles, Users, Minus, Plus } from "lucide-react";
import { HOTELS } from "@/lib/data/hotels";
import { roomsByHotel } from "@/lib/data/catalog";
import { addDays, todayIso } from "@/lib/dates";
import HotelCard from "@/components/HotelCard";

export default function HotelsPage() {
  const [checkIn, setCheckIn] = useState(() => addDays(todayIso(), 1));
  const [checkOut, setCheckOut] = useState(() => addDays(todayIso(), 2));
  const [guests, setGuests] = useState(2);

  function handleCheckInChange(value: string) {
    setCheckIn(value);
    if (value >= checkOut) setCheckOut(addDays(value, 1));
  }

  const results = useMemo(() => {
    return HOTELS.map((hotel) => {
      const rooms = roomsByHotel(hotel.id).filter((r) => (r.maxGuests ?? 99) >= guests);
      return { hotel, fromPrice: rooms.length > 0 ? rooms[0].price : null };
    })
      .filter((r): r is { hotel: (typeof HOTELS)[number]; fromPrice: number } => r.fromPrice !== null)
      .sort((a, b) => a.fromPrice - b.fromPrice);
  }, [guests]);

  return (
    <div className="px-5 pt-6 pb-10">
      <Link href="/explore" className="inline-flex items-center gap-1 text-sm text-ink/50 hover:text-ink">
        <ChevronLeft size={16} /> Explore
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-ink">Book a hotel</h1>
      <p className="mt-1 text-sm text-ink/50">Same catalog the AI concierge uses — pick dates and compare rooms.</p>

      <Link
        href="/"
        className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-accentSoft px-3 py-1.5 text-xs font-medium text-accentDark transition hover:brightness-95"
      >
        <Sparkles size={12} /> Prefer to just ask? Try the AI tab
      </Link>

      <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl2 border border-black/10 bg-white p-3 shadow-sm">
        <label className="block">
          <span className="text-[10px] font-medium uppercase tracking-wide text-ink/40">Check-in</span>
          <input
            type="date"
            min={todayIso()}
            value={checkIn}
            onChange={(e) => handleCheckInChange(e.target.value)}
            className="mt-0.5 w-full bg-transparent text-sm text-ink outline-none"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-medium uppercase tracking-wide text-ink/40">Check-out</span>
          <input
            type="date"
            min={addDays(checkIn, 1)}
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
            className="mt-0.5 w-full bg-transparent text-sm text-ink outline-none"
          />
        </label>
        <div className="col-span-2 mt-1 flex items-center justify-between border-t border-black/5 pt-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink/60">
            <Users size={13} /> Guests
          </span>
          <div className="inline-flex items-center gap-3">
            <button
              onClick={() => setGuests((g) => Math.max(1, g - 1))}
              className="flex h-6 w-6 items-center justify-center rounded-full border border-black/10 text-ink/60 hover:border-ink/40"
            >
              <Minus size={12} />
            </button>
            <span className="w-4 text-center text-sm font-semibold text-ink">{guests}</span>
            <button
              onClick={() => setGuests((g) => Math.min(6, g + 1))}
              className="flex h-6 w-6 items-center justify-center rounded-full border border-black/10 text-ink/60 hover:border-ink/40"
            >
              <Plus size={12} />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {results.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink/40">No rooms fit {guests} guests — try fewer guests.</p>
        ) : (
          results.map(({ hotel, fromPrice }) => (
            <HotelCard key={hotel.id} hotel={hotel} fromPrice={fromPrice} checkIn={checkIn} checkOut={checkOut} guests={guests} />
          ))
        )}
      </div>
    </div>
  );
}
