"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Users, ShieldCheck, Wallet, CreditCard } from "lucide-react";
import clsx from "clsx";
import { Hotel } from "@/lib/types";
import { findById } from "@/lib/data/catalog";
import { useAppStore, PaymentSource } from "@/lib/store/useAppStore";
import { BRAND_LABEL } from "@/lib/payments";
import { addDays, formatDateLabel, todayIso } from "@/lib/dates";
import { nightsBetween, priceStay } from "@/lib/pricing";
import BillSummary from "@/components/BillSummary";

export default function HotelBookingView({ hotel }: { hotel: Hotel }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const walletBalance = useAppStore((s) => s.walletBalance);
  const paymentMethods = useAppStore((s) => s.paymentMethods);
  const bookHotel = useAppStore((s) => s.bookHotel);

  const roomId = searchParams.get("room") ?? "";
  const checkIn = searchParams.get("checkin") || addDays(todayIso(), 1);
  const checkOut = searchParams.get("checkout") || addDays(todayIso(), 2);
  const guestsParam = Number(searchParams.get("guests"));
  const guests = Number.isFinite(guestsParam) && guestsParam > 0 ? guestsParam : 2;

  const room = findById(roomId);
  const roomValid = room && room.category === "hotels" && room.providerId === hotel.id;

  const nights = nightsBetween(checkIn, checkOut);
  const { roomTotal, taxesAndFees, total } = priceStay(roomValid ? room!.price : 0, nights);

  const defaultCard = paymentMethods.find((m) => m.isDefault) ?? paymentMethods[0];
  const [source, setSource] = useState<PaymentSource | undefined>(walletBalance >= total ? "wallet" : defaultCard?.id);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!roomValid) {
    return (
      <div className="px-5 pt-6 pb-10">
        <Link href={`/explore/hotels/${hotel.id}`} className="inline-flex items-center gap-1 text-sm text-ink/50 hover:text-ink">
          <ChevronLeft size={16} /> {hotel.name}
        </Link>
        <p className="mt-10 text-center text-sm text-ink/40">
          That room isn&apos;t available anymore — go back and pick another.
        </p>
      </div>
    );
  }

  function handleBook() {
    if (!source) return;
    setPlacing(true);
    setError(null);
    const result = bookHotel({ itemId: room!.id, checkIn, checkOut, guests, source });
    setPlacing(false);
    if (result.ok) {
      router.push("/activity");
    } else if (result.reason === "insufficient_balance") {
      setError("Insufficient wallet balance — top up or pick a card.");
    } else if (result.reason === "no_payment_method") {
      setError("No payment method available.");
    } else if (result.reason === "invalid_dates") {
      setError("Check-out must be after check-in — go back and adjust your dates.");
    } else {
      setError("That room isn't available anymore.");
    }
  }

  return (
    <div className="px-5 pt-6 pb-8">
      <Link href={`/explore/hotels/${hotel.id}`} className="inline-flex items-center gap-1 text-sm text-ink/50 hover:text-ink">
        <ChevronLeft size={16} /> {hotel.name}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-ink">Confirm your booking</h1>

      <div className="mt-4 rounded-xl2 border border-black/5 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-ink">{hotel.name}</p>
        <p className="text-xs text-ink/50">{room!.title}</p>
        <div className="mt-3 flex items-center justify-between border-t border-black/5 pt-3 text-sm">
          <span className="text-ink/60">Dates</span>
          <span className="font-medium text-ink">
            {formatDateLabel(checkIn)} – {formatDateLabel(checkOut)}
          </span>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-sm">
          <span className="text-ink/60">Duration</span>
          <span className="font-medium text-ink">
            {nights} night{nights > 1 ? "s" : ""}
          </span>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-sm">
          <span className="inline-flex items-center gap-1 text-ink/60">
            <Users size={13} /> Guests
          </span>
          <span className="font-medium text-ink">{guests}</span>
        </div>
        <p
          className={clsx(
            "mt-2.5 inline-flex items-center gap-1 text-xs font-medium",
            room!.freeCancellation ? "text-emerald-700" : "text-ink/45"
          )}
        >
          <ShieldCheck size={12} />
          {room!.freeCancellation ? "Free cancellation until check-in" : "Non-refundable — no changes or cancellations"}
        </p>
      </div>

      <div className="mt-4">
        <BillSummary
          rows={[
            { label: `₹${room!.price.toLocaleString("en-IN")} × ${nights} night${nights > 1 ? "s" : ""}`, amount: roomTotal },
            { label: "Taxes and fees", amount: taxesAndFees },
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
        {placing ? "Confirming…" : `Complete booking · ₹${total.toLocaleString("en-IN")}`}
      </button>
    </div>
  );
}
