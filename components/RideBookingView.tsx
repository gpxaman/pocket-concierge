"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, MapPin, Navigation, Star, Phone, Wallet, CreditCard, CheckCircle2 } from "lucide-react";
import clsx from "clsx";
import { findRideType, RIDE_TYPE_ICON } from "@/lib/data/rideTypes";
import { priceRide } from "@/lib/pricing";
import { useAppStore, PaymentSource } from "@/lib/store/useAppStore";
import { BRAND_LABEL } from "@/lib/payments";
import { Driver } from "@/lib/data/drivers";
import BillSummary from "@/components/BillSummary";

export default function RideBookingView() {
  const searchParams = useSearchParams();
  const walletBalance = useAppStore((s) => s.walletBalance);
  const paymentMethods = useAppStore((s) => s.paymentMethods);
  const bookRide = useAppStore((s) => s.bookRide);

  const typeId = searchParams.get("type") ?? "";
  const pickup = searchParams.get("pickup") ?? "";
  const drop = searchParams.get("drop") ?? "";
  const distanceKm = Number(searchParams.get("distance")) || 6;

  const rideType = findRideType(typeId);

  const defaultCard = paymentMethods.find((m) => m.isDefault) ?? paymentMethods[0];
  const { baseFare, distanceFare, total } = rideType ? priceRide(rideType, distanceKm) : { baseFare: 0, distanceFare: 0, total: 0 };
  const [source, setSource] = useState<PaymentSource | undefined>(walletBalance >= total ? "wallet" : defaultCard?.id);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ driver: Driver } | null>(null);

  if (!rideType || !pickup || !drop) {
    return (
      <div className="px-5 pt-6 pb-10">
        <Link href="/explore/rides" className="inline-flex items-center gap-1 text-sm text-ink/50 hover:text-ink">
          <ChevronLeft size={16} /> Rides
        </Link>
        <p className="mt-10 text-center text-sm text-ink/40">That ride isn&apos;t available anymore — go back and pick again.</p>
      </div>
    );
  }

  function handleBook() {
    if (!source) return;
    setPlacing(true);
    setError(null);
    const result = bookRide({ rideTypeId: rideType!.id, pickup, drop, distanceKm, source }, { placedBy: "USER" });
    setPlacing(false);
    if (result.ok) {
      setConfirmed({ driver: result.driver });
    } else if (result.reason === "insufficient_balance") {
      setError("Insufficient wallet balance — top up or pick a card.");
    } else if (result.reason === "no_payment_method") {
      setError("No payment method available.");
    } else {
      setError("That ride type isn't available.");
    }
  }

  if (confirmed) {
    const Icon = RIDE_TYPE_ICON[rideType.id];
    return (
      <div className="px-5 pt-6 pb-10">
        <div className="flex flex-col items-center pt-6 text-center">
          <CheckCircle2 size={40} className="text-emerald-600" />
          <h1 className="mt-3 text-xl font-semibold text-ink">Driver assigned</h1>
          <p className="mt-1 text-sm text-ink/50">
            Arriving in ~{rideType.etaMinutes} min to {pickup}
          </p>
        </div>

        <div className="mt-5 rounded-xl2 border border-black/5 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accentSoft text-accentDark">
              <Icon size={22} strokeWidth={1.7} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">{confirmed.driver.name}</p>
              <p className="text-xs text-ink/50">{confirmed.driver.vehicleModel}</p>
              <p className="text-xs text-ink/45">{confirmed.driver.vehicleNumber}</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded bg-emerald-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
              <Star size={10} className="fill-white" /> {confirmed.driver.rating}
            </span>
          </div>
          <button className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full border border-black/10 py-2 text-xs font-medium text-ink/70">
            <Phone size={13} /> Call driver (demo)
          </button>
        </div>

        <div className="mt-4 rounded-xl2 border border-black/5 bg-white p-4 text-sm shadow-sm">
          <div className="flex items-center gap-2">
            <MapPin size={14} className="text-emerald-600" /> <span className="truncate text-ink/70">{pickup}</span>
          </div>
          <div className="ml-[7px] my-1 h-3 border-l border-dashed border-black/15" />
          <div className="flex items-center gap-2">
            <Navigation size={14} className="text-red-500" /> <span className="truncate text-ink/70">{drop}</span>
          </div>
        </div>

        <Link
          href="/activity"
          className="mt-5 flex w-full items-center justify-center rounded-full bg-accent py-3 text-sm font-semibold text-ink transition hover:brightness-95"
        >
          Track in Activity
        </Link>
      </div>
    );
  }

  return (
    <div className="px-5 pt-6 pb-8">
      <Link href="/explore/rides" className="inline-flex items-center gap-1 text-sm text-ink/50 hover:text-ink">
        <ChevronLeft size={16} /> Rides
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-ink">Confirm your ride</h1>

      <div className="mt-4 rounded-xl2 border border-black/5 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-ink">{rideType.label}</p>
        <p className="text-xs text-ink/50">{rideType.subtitle}</p>
        <div className="mt-3 border-t border-black/5 pt-3 text-sm">
          <div className="flex items-center gap-2">
            <MapPin size={14} className="text-emerald-600" /> <span className="truncate text-ink/70">{pickup}</span>
          </div>
          <div className="ml-[7px] my-1 h-3 border-l border-dashed border-black/15" />
          <div className="flex items-center gap-2">
            <Navigation size={14} className="text-red-500" /> <span className="truncate text-ink/70">{drop}</span>
          </div>
        </div>
        <p className="mt-2 text-xs text-ink/40">~{distanceKm} km · driver in ~{rideType.etaMinutes} min</p>
      </div>

      <div className="mt-4">
        <BillSummary
          rows={[
            { label: "Base fare", amount: baseFare },
            { label: `Distance (${distanceKm} km)`, amount: distanceFare },
          ]}
          total={total}
        />
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
        {!source && (
          <p className="mt-1.5 text-xs text-red-600">
            No balance or card on file —{" "}
            <Link href="/wallet" className="underline">
              add money or a card
            </Link>{" "}
            first.
          </p>
        )}
      </div>

      {error && <p className="mt-3 text-xs font-medium text-red-600">{error}</p>}

      <button
        onClick={handleBook}
        disabled={!source || placing}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3 text-sm font-semibold text-ink transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {placing ? "Confirming…" : `Confirm ride · ₹${total.toLocaleString("en-IN")}`}
      </button>
    </div>
  );
}
