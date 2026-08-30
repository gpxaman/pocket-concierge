"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Sparkles, MapPin, Navigation } from "lucide-react";
import clsx from "clsx";
import { RIDE_TYPES, RIDE_TYPE_ICON } from "@/lib/data/rideTypes";
import { priceRide } from "@/lib/pricing";

const DISTANCE_PRESETS = [
  { label: "Short", km: 2 },
  { label: "Medium", km: 6 },
  { label: "Long", km: 12 },
];

export default function RidesPage() {
  const [pickup, setPickup] = useState("");
  const [drop, setDrop] = useState("");
  const [distanceKm, setDistanceKm] = useState(6);

  const canBook = Boolean(pickup.trim() && drop.trim());

  return (
    <div className="px-5 pt-6 pb-10">
      <Link href="/explore" className="inline-flex items-center gap-1 text-sm text-ink/50 hover:text-ink">
        <ChevronLeft size={16} /> Explore
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-ink">Get a ride</h1>
      <p className="mt-1 text-sm text-ink/50">Enter pickup and drop, then compare rides — same catalog the AI concierge uses.</p>

      <Link
        href="/"
        className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-accentSoft px-3 py-1.5 text-xs font-medium text-accentDark transition hover:brightness-95"
      >
        <Sparkles size={12} /> Prefer to just ask? Try the AI tab
      </Link>

      <div className="mt-4 space-y-2 rounded-xl2 border border-black/10 bg-white p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <MapPin size={15} className="shrink-0 text-emerald-600" />
          <input
            value={pickup}
            onChange={(e) => setPickup(e.target.value)}
            placeholder="Pickup location"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink/35"
          />
        </div>
        <div className="border-t border-black/5" />
        <div className="flex items-center gap-2">
          <Navigation size={15} className="shrink-0 text-red-500" />
          <input
            value={drop}
            onChange={(e) => setDrop(e.target.value)}
            placeholder="Drop location"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink/35"
          />
        </div>
      </div>

      <div className="mt-3">
        <p className="mb-1.5 text-xs font-medium text-ink/50">Estimated distance</p>
        <div className="flex gap-2">
          {DISTANCE_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => setDistanceKm(p.km)}
              className={clsx(
                "flex-1 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                distanceKm === p.km ? "border-ink bg-ink text-white" : "border-black/15 text-ink/70 hover:border-ink/40"
              )}
            >
              {p.label} · ~{p.km} km
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {RIDE_TYPES.map((rt) => {
          const Icon = RIDE_TYPE_ICON[rt.id];
          const { total } = priceRide(rt, distanceKm);
          const href = `/explore/rides/book?type=${rt.id}&pickup=${encodeURIComponent(pickup)}&drop=${encodeURIComponent(drop)}&distance=${distanceKm}`;
          return (
            <div key={rt.id} className="flex items-center gap-3 rounded-xl2 border border-black/5 bg-white p-3 shadow-sm">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accentSoft text-accentDark">
                <Icon size={22} strokeWidth={1.7} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{rt.label}</p>
                <p className="truncate text-xs text-ink/45">{rt.subtitle}</p>
                <p className="mt-0.5 text-xs text-ink/40">{rt.etaMinutes} min away</p>
              </div>
              <div className="text-right">
                <p className="text-base font-bold text-ink">₹{total.toLocaleString("en-IN")}</p>
                {canBook ? (
                  <Link
                    href={href}
                    className="mt-1 inline-block rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-ink transition hover:brightness-95"
                  >
                    Book
                  </Link>
                ) : (
                  <span className="mt-1 inline-block rounded-full bg-black/5 px-3 py-1.5 text-xs font-medium text-ink/35">Book</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {!canBook && <p className="mt-3 text-center text-xs text-ink/35">Enter pickup and drop to book a ride.</p>}
    </div>
  );
}
