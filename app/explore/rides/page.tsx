"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/lib/store/useAppStore";
import { useRideStore } from "@/lib/store/useRideStore";
import { RIDE_TIERS, estimateDistanceKm, fareFor, surgeFor, PLACE_SUGGESTIONS } from "@/lib/rides";
import { BRAND_LABEL } from "@/lib/payments";
import LiveTrackMap from "@/components/LiveTrackMap";
import {
  ChevronLeft,
  MapPin,
  Navigation,
  Car,
  Wallet,
  CreditCard,
  X,
  Star,
  Phone,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import clsx from "clsx";

function StarRow({ value, onRate }: { value: number; onRate: (n: number) => void }) {
  return (
    <div className="flex justify-center gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} onClick={() => onRate(n)}>
          <Star size={28} className={n <= value ? "fill-accent text-accent" : "text-white/25"} />
        </button>
      ))}
    </div>
  );
}

export default function RidesPage() {
  const activeRide = useRideStore((s) => s.activeRide);
  const requestRide = useRideStore((s) => s.requestRide);
  const cancelRide = useRideStore((s) => s.cancelRide);
  const rateDriver = useRideStore((s) => s.rateDriver);
  const clearRide = useRideStore((s) => s.clearRide);

  const createDraft = useAppStore((s) => s.createDraft);
  const authorizeTransaction = useAppStore((s) => s.authorizeTransaction);
  const walletBalance = useAppStore((s) => s.walletBalance);
  const paymentMethods = useAppStore((s) => s.paymentMethods);

  const [pickup, setPickup] = useState("Current Location");
  const [destination, setDestination] = useState("");
  const [selectedTierId, setSelectedTierId] = useState(RIDE_TIERS[1].id);
  const [source, setSource] = useState<string | undefined>(undefined);
  const [requestError, setRequestError] = useState("");

  const hasDestination = destination.trim().length > 0;
  const distanceKm = useMemo(() => (hasDestination ? estimateDistanceKm(pickup, destination) : 0), [pickup, destination, hasDestination]);
  const surge = useMemo(() => (hasDestination ? surgeFor(pickup, destination) : 1), [pickup, destination, hasDestination]);
  const tiers = RIDE_TIERS.map((t) => ({ ...t, fare: fareFor(t, distanceKm, surge), etaMin: 2 + (t.id.length % 4) }));
  const selectedTier = tiers.find((t) => t.id === selectedTierId)!;

  const defaultSource = source ?? (walletBalance >= selectedTier.fare ? "wallet" : paymentMethods.find((m) => m.isDefault)?.id ?? paymentMethods[0]?.id);
  const hasAnyPaymentOption = walletBalance >= selectedTier.fare || paymentMethods.length > 0;

  function handleRequest() {
    if (!hasDestination) return;
    if (!hasAnyPaymentOption || !defaultSource) {
      setRequestError("no_payment");
      return;
    }
    const item = {
      id: `ride-${selectedTier.id}`,
      category: "rides" as const,
      providerId: "ridenow",
      providerName: "RideNow",
      title: `${selectedTier.name} · ${pickup} → ${destination}`,
      price: selectedTier.fare,
      currency: "INR" as const,
      attributes: {},
    };
    const tx = createDraft(item, "RIDE");
    const result = authorizeTransaction(tx.id, defaultSource);
    if (!result.ok) {
      setRequestError("no_payment");
      return;
    }
    setRequestError("");
    requestRide({
      tierId: selectedTier.id,
      tierName: selectedTier.name,
      pickup,
      destination,
      distanceKm,
      fare: selectedTier.fare,
      transactionId: tx.id,
    });
  }

  if (activeRide && activeRide.phase !== "cancelled") {
    return <RideTracker onDone={clearRide} onCancel={cancelRide} onRate={rateDriver} />;
  }

  return (
    <div className="px-5 pt-6 pb-24">
      <Link href="/explore" className="inline-flex items-center gap-1 text-sm text-ink/50 hover:text-ink">
        <ChevronLeft size={16} /> Explore
      </Link>

      <div className="mt-2 flex items-center gap-2">
        <h1 className="text-2xl font-semibold text-ink">Book a ride</h1>
        <Sparkles size={16} className="text-accentDark" />
      </div>
      <p className="text-sm text-ink/45">Where to? Pick your ride, we'll handle the rest.</p>

      <div className="mt-4 space-y-2 rounded-xl2 border border-black/10 bg-white p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink/10">
            <Navigation size={12} className="text-ink/60" />
          </span>
          <input
            value={pickup}
            onChange={(e) => setPickup(e.target.value)}
            className="flex-1 bg-transparent text-sm font-medium text-ink outline-none"
            placeholder="Pickup location"
          />
        </div>
        <div className="ml-3 h-3 border-l-2 border-dotted border-black/15" />
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accentSoft">
            <MapPin size={12} className="text-accentDark" />
          </span>
          <input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="flex-1 bg-transparent text-sm font-medium text-ink outline-none"
            placeholder="Where are you headed?"
          />
        </div>
      </div>

      {!hasDestination && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PLACE_SUGGESTIONS.map((p) => (
            <button
              key={p}
              onClick={() => setDestination(p)}
              className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-ink/60 hover:border-accentDark"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {hasDestination && (
        <>
          <LiveTrackMap progress={0.08} icon={Car} fromLabel={pickup} toLabel={destination} />
          {surge > 1 && (
            <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-700">
              🔥 {surge}x demand right now
            </p>
          )}

          <div className="mt-3 space-y-2">
            {tiers.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTierId(t.id)}
                className={clsx(
                  "flex w-full items-center gap-3 rounded-xl2 border p-3 text-left transition",
                  selectedTierId === t.id ? "border-ink bg-ink text-white" : "border-black/10 bg-white text-ink hover:border-accentDark/40"
                )}
              >
                <span className="text-2xl">{t.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{t.name} · {t.capacity} seats</p>
                  <p className={clsx("text-xs", selectedTierId === t.id ? "text-white/60" : "text-ink/45")}>
                    {t.tagline} · {t.etaMin} min away
                  </p>
                </div>
                <p className="text-sm font-bold">₹{t.fare.toLocaleString("en-IN")}</p>
              </button>
            ))}
          </div>

          <div className="mt-4">
            {requestError === "no_payment" && (
              <p className="mb-2 text-xs text-red-600">
                No balance or card on file —{" "}
                <Link href="/wallet" className="underline">
                  add money or a card
                </Link>{" "}
                first.
              </p>
            )}
            <div className="mb-2 flex flex-wrap gap-1.5">
              <button
                onClick={() => setSource("wallet")}
                disabled={walletBalance < selectedTier.fare}
                className={clsx(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40",
                  defaultSource === "wallet" ? "border-ink bg-ink text-white" : "border-black/15 bg-white text-ink/70"
                )}
              >
                <Wallet size={11} /> Wallet ₹{walletBalance.toLocaleString("en-IN")}
              </button>
              {paymentMethods.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSource(m.id)}
                  className={clsx(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                    defaultSource === m.id ? "border-ink bg-ink text-white" : "border-black/15 bg-white text-ink/70"
                  )}
                >
                  <CreditCard size={11} /> {BRAND_LABEL[m.brand]} •••• {m.last4}
                </button>
              ))}
            </div>
            <button
              onClick={handleRequest}
              className="w-full rounded-full bg-accent py-3 text-center text-sm font-bold text-ink shadow-md transition active:scale-[0.99]"
            >
              Request {selectedTier.name} · ₹{selectedTier.fare.toLocaleString("en-IN")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const RIDE_COPY: Record<string, { title: string; sub: string }> = {
  searching: { title: "Finding your driver…", sub: "Matching you with someone nearby" },
  assigned: { title: "Driver's on the way! 🚗💨", sub: "" },
  arrived: { title: "Your driver has arrived", sub: "Look for them outside" },
  in_progress: { title: "On your way", sub: "Sit back, you're headed there" },
  completed: { title: "You've arrived! 🎉", sub: "Hope that was a smooth ride" },
};

function RideTracker({
  onDone,
  onCancel,
  onRate,
}: {
  onDone: () => void;
  onCancel: () => void;
  onRate: (n: number) => void;
}) {
  const ride = useRideStore((s) => s.activeRide)!;
  const copy = RIDE_COPY[ride.phase] ?? RIDE_COPY.searching;

  const progress =
    ride.phase === "searching"
      ? 0
      : ride.phase === "assigned"
        ? 0.15
        : ride.phase === "arrived"
          ? 0.35
          : ride.phase === "in_progress"
            ? 0.75
            : 1;

  if (ride.phase === "completed") {
    return (
      <div className="fixed inset-0 z-30 mx-auto flex max-w-md flex-col bg-gradient-to-b from-[#171106] via-[#0e0a03] to-black px-6 py-10 text-white">
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <p className="text-4xl">🎉</p>
          <h1 className="text-2xl font-bold">{copy.title}</h1>
          <p className="text-sm text-white/50">{copy.sub}</p>

          <div className="mt-4 w-full rounded-xl2 bg-white/5 p-4 text-left">
            <div className="flex justify-between text-sm">
              <span className="text-white/50">{ride.tierName} · {ride.distanceKm} km</span>
              <span className="font-semibold">₹{ride.fare.toLocaleString("en-IN")}</span>
            </div>
            <p className="mt-1 truncate text-xs text-white/40">{ride.pickup} → {ride.destination}</p>
          </div>

          <p className="mt-2 text-sm text-white/60">Rate {ride.driver?.name ?? "your driver"}</p>
          <StarRow value={ride.driverRating ?? 0} onRate={onRate} />
        </div>
        <button onClick={onDone} className="mt-6 w-full rounded-full bg-accent py-3 text-sm font-bold text-ink">
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-30 mx-auto flex max-w-md flex-col overflow-y-auto bg-paper px-5 pt-6 pb-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink">{copy.title}</h1>
        {ride.phase !== "in_progress" && (
          <button onClick={onCancel} className="flex h-8 w-8 items-center justify-center rounded-full bg-ink/5 text-ink/50 hover:text-red-500">
            <X size={16} />
          </button>
        )}
      </div>
      {copy.sub && <p className="text-sm text-ink/45">{copy.sub}</p>}

      <div className="mt-3">
        <LiveTrackMap progress={progress} icon={Car} fromLabel={ride.pickup} toLabel={ride.destination} />
      </div>

      {ride.phase === "searching" && (
        <div className="mt-6 flex flex-col items-center gap-3 py-6">
          <motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ repeat: Infinity, duration: 1.4 }}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-accentSoft"
          >
            <Car size={26} className="text-accentDark" />
          </motion.div>
          <p className="text-xs text-ink/40">Usually takes a few seconds…</p>
        </div>
      )}

      <AnimatePresence>
        {ride.driver && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-xl2 border border-black/10 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accentSoft text-base font-semibold text-accentDark">
                {ride.driver.name.slice(0, 1)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{ride.driver.name}</p>
                <p className="text-xs text-ink/45">{ride.driver.vehicle} · {ride.driver.plate}</p>
              </div>
              <p className="inline-flex items-center gap-1 text-xs font-medium text-ink/60">
                <Star size={11} className="fill-accent text-accent" /> {ride.driver.rating}
              </p>
              <button className="flex h-9 w-9 items-center justify-center rounded-full bg-ink/5 text-ink/50">
                <Phone size={14} />
              </button>
            </div>
            {ride.etaMinutes !== null && ride.phase === "assigned" && (
              <p className="mt-2 text-xs text-ink/50">Arriving in ~{ride.etaMinutes} min</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-4 rounded-xl2 bg-ink/5 p-3">
        <p className="inline-flex items-center gap-1.5 text-xs text-ink/50">
          <ShieldCheck size={12} /> ₹{ride.fare.toLocaleString("en-IN")} · {ride.tierName} · authorized upfront (PRD §8)
        </p>
      </div>
    </div>
  );
}
