"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Sparkles, Search, Pencil, LocateFixed, Wallet, CreditCard } from "lucide-react";
import clsx from "clsx";
import { RIDE_TYPES, RIDE_TYPE_ICON } from "@/lib/data/rideTypes";
import { priceRide } from "@/lib/pricing";
import { BRAND_LABEL } from "@/lib/payments";
import { useAppStore, PaymentSource } from "@/lib/store/useAppStore";
import MapPlaceholder from "@/components/MapPlaceholder";
import { LocationPin, VehicleMarker } from "@/components/MapPin";

type Step = "pickup" | "drop" | "choose";

const PICKUP = { x: 50, y: 54 };
// % of map width per km — a 42%-radius drop pin lands ~9km away, a
// realistic city-ride range matching the old Short/Medium/Long presets.
const PERCENT_TO_KM = 0.22;

function randomPoint(minRadius: number, maxRadius: number) {
  const angle = Math.random() * Math.PI * 2;
  const radius = minRadius + Math.random() * (maxRadius - minRadius);
  const x = Math.min(92, Math.max(8, PICKUP.x + radius * Math.cos(angle)));
  const y = Math.min(88, Math.max(16, PICKUP.y + radius * Math.sin(angle)));
  return { x, y };
}

export default function RideRequestPanel() {
  const walletBalance = useAppStore((s) => s.walletBalance);
  const paymentMethods = useAppStore((s) => s.paymentMethods);
  const requestRide = useAppStore((s) => s.requestRide);

  const [step, setStep] = useState<Step>("pickup");
  const [pickupLabel, setPickupLabel] = useState("Current Location");
  const [editingPickup, setEditingPickup] = useState(false);
  const [dropLabel, setDropLabel] = useState("");
  const [dropInput, setDropInput] = useState("");
  const [dropPoint, setDropPoint] = useState<{ x: number; y: number } | null>(null);
  const [distanceKm, setDistanceKm] = useState(6);
  const [selectedTypeId, setSelectedTypeId] = useState(RIDE_TYPES[0].id);
  const [error, setError] = useState<string | null>(null);

  const defaultCard = paymentMethods.find((m) => m.isDefault) ?? paymentMethods[0];
  const selectedType = RIDE_TYPES.find((rt) => rt.id === selectedTypeId) ?? RIDE_TYPES[0];
  const { total } = priceRide(selectedType, distanceKm);
  const [source, setSource] = useState<PaymentSource | undefined>(walletBalance >= total ? "wallet" : defaultCard?.id);

  useEffect(() => {
    setSource(walletBalance >= total ? "wallet" : defaultCard?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTypeId, distanceKm]);

  // Generated client-side only, after mount — Math.random() during the
  // initial render would differ between SSR and the client's first pass
  // and trigger a hydration mismatch.
  const [ambientVehicles, setAmbientVehicles] = useState<{ x: number; y: number; icon: (typeof RIDE_TYPE_ICON)[string] }[]>([]);
  useEffect(() => {
    setAmbientVehicles(
      Array.from({ length: 5 }).map((_, i) => ({
        ...randomPoint(10, 30),
        icon: RIDE_TYPE_ICON[RIDE_TYPES[i % RIDE_TYPES.length].id],
      }))
    );
  }, []);

  function confirmDrop(e: React.FormEvent) {
    e.preventDefault();
    const value = dropInput.trim();
    if (!value) return;
    const point = randomPoint(18, 42);
    const km = Math.max(1.5, Math.round(Math.hypot(point.x - PICKUP.x, point.y - PICKUP.y) * PERCENT_TO_KM * 10) / 10);
    setDropPoint(point);
    setDistanceKm(km);
    setDropLabel(value);
    setStep("choose");
  }

  function handleRequest() {
    if (!source || !dropPoint) return;
    setError(null);
    const result = requestRide({
      rideTypeId: selectedType.id,
      pickup: pickupLabel,
      drop: dropLabel,
      pickupPoint: PICKUP,
      dropPoint,
      distanceKm,
      source,
    });
    if (!result.ok) {
      setError(
        result.reason === "insufficient_balance"
          ? "Insufficient wallet balance — top up or pick a card."
          : result.reason === "no_payment_method"
            ? "No payment method available."
            : result.reason === "ride_in_progress"
              ? "You already have a ride in progress."
              : "That ride type isn't available."
      );
    }
  }

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col">
      <div className="relative z-10 flex items-center justify-between px-5 pt-5">
        <Link href="/explore" className="inline-flex items-center gap-1 text-sm text-ink/50 hover:text-ink">
          <ChevronLeft size={16} /> Explore
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-full bg-accentSoft px-3 py-1.5 text-xs font-medium text-accentDark transition hover:brightness-95"
        >
          <Sparkles size={12} /> Ask the AI instead
        </Link>
      </div>

      <MapPlaceholder className="relative mt-3 flex-1">
        {ambientVehicles.map((v, i) => (
          <VehicleMarker key={i} x={v.x} y={v.y} icon={v.icon} delayMs={i * 90} />
        ))}

        {dropPoint && step === "choose" && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full">
            <line
              x1={`${PICKUP.x}%`}
              y1={`${PICKUP.y}%`}
              x2={`${dropPoint.x}%`}
              y2={`${dropPoint.y}%`}
              stroke="#1a1508"
              strokeOpacity={0.35}
              strokeWidth={2}
              strokeDasharray="6 6"
            />
          </svg>
        )}

        <LocationPin x={PICKUP.x} y={PICKUP.y} kind="pickup" />
        {dropPoint && <LocationPin x={dropPoint.x} y={dropPoint.y} kind="drop" animate />}
      </MapPlaceholder>

      {/* Bottom sheet — content depends on step, map stays visible above it */}
      <div className="relative z-10 max-h-[60vh] overflow-y-auto rounded-t-[1.5rem] bg-paper px-5 pb-5 pt-4 shadow-[0_-8px_24px_rgba(0,0,0,0.06)]">
        {step === "pickup" && (
          <>
            <p className="text-sm font-semibold text-ink">Confirm your pickup</p>
            <div className="mt-2 flex items-center gap-2 rounded-xl2 border border-black/10 bg-white px-3 py-2.5">
              <LocateFixed size={16} className="shrink-0 text-emerald-600" />
              {editingPickup ? (
                <input
                  autoFocus
                  value={pickupLabel}
                  onChange={(e) => setPickupLabel(e.target.value)}
                  onBlur={() => setEditingPickup(false)}
                  className="flex-1 bg-transparent text-sm outline-none"
                />
              ) : (
                <span className="flex-1 truncate text-sm text-ink">{pickupLabel}</span>
              )}
              <button onClick={() => setEditingPickup(true)} className="shrink-0 text-ink/35 hover:text-ink">
                <Pencil size={14} />
              </button>
            </div>
            <button
              onClick={() => setStep("drop")}
              className="mt-3 flex w-full items-center justify-center rounded-full bg-accent py-3 text-sm font-semibold text-ink transition hover:brightness-95"
            >
              Confirm pickup
            </button>
          </>
        )}

        {step === "drop" && (
          <>
            <p className="text-sm font-semibold text-ink">Where to?</p>
            <form onSubmit={confirmDrop} className="mt-2 flex items-center gap-2 rounded-xl2 border border-black/10 bg-white px-3 py-2.5">
              <Search size={16} className="shrink-0 text-ink/35" />
              <input
                autoFocus
                value={dropInput}
                onChange={(e) => setDropInput(e.target.value)}
                placeholder="Search for a drop location"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink/35"
              />
              <button
                type="submit"
                disabled={!dropInput.trim()}
                className="shrink-0 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-40"
              >
                Set
              </button>
            </form>
          </>
        )}

        {step === "choose" && dropPoint && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-ink">Choose a ride</p>
              <span className="text-xs text-ink/40">~{distanceKm} km · {dropLabel}</span>
            </div>
            <div className="mt-3 space-y-2">
              {RIDE_TYPES.map((rt) => {
                const Icon = RIDE_TYPE_ICON[rt.id];
                const { total: rtTotal } = priceRide(rt, distanceKm);
                const selected = rt.id === selectedTypeId;
                return (
                  <button
                    key={rt.id}
                    onClick={() => setSelectedTypeId(rt.id)}
                    className={clsx(
                      "flex w-full items-center gap-3 rounded-xl2 border bg-white p-3 text-left shadow-sm transition",
                      selected ? "border-accentDark ring-1 ring-accentDark/40" : "border-black/5 hover:border-accentDark/40"
                    )}
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accentSoft text-accentDark">
                      <Icon size={20} strokeWidth={1.7} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink">{rt.label}</p>
                      <p className="truncate text-xs text-ink/45">{rt.subtitle} · {rt.etaMinutes} min away</p>
                    </div>
                    <p className="text-base font-bold text-ink">₹{rtTotal.toLocaleString("en-IN")}</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-4">
              <p className="mb-1.5 text-xs font-medium text-ink/50">Pay with</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSource("wallet")}
                  disabled={walletBalance < total}
                  className={clsx(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40",
                    source === "wallet" ? "border-ink bg-ink text-white" : "border-black/15 bg-white text-ink/70 hover:border-ink/40"
                  )}
                >
                  <Wallet size={11} /> Wallet ₹{walletBalance.toLocaleString("en-IN")}
                </button>
                {paymentMethods.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSource(m.id)}
                    className={clsx(
                      "inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[11px] font-medium transition",
                      source === m.id ? "border-ink bg-ink text-white" : "border-black/15 bg-white text-ink/70 hover:border-ink/40"
                    )}
                  >
                    <CreditCard size={11} /> {BRAND_LABEL[m.brand]} •••• {m.last4}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="mt-3 text-xs font-medium text-red-600">{error}</p>}

            <button
              onClick={handleRequest}
              disabled={!source}
              className="mt-4 flex w-full items-center justify-center rounded-full bg-accent py-3 text-sm font-semibold text-ink transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Request {selectedType.label} · ₹{total.toLocaleString("en-IN")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
