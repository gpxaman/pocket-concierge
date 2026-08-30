"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/lib/store/useAppStore";
import { useFoodOrderStore } from "@/lib/store/useFoodOrderStore";
import { byCategory } from "@/lib/data/catalog";
import { DELIVERY_FEE, PLATFORM_FEE, ADDRESS_SUGGESTIONS } from "@/lib/food";
import { BRAND_LABEL } from "@/lib/payments";
import LiveTrackMap from "@/components/LiveTrackMap";
import {
  ChevronLeft,
  MapPin,
  Bike,
  Star,
  Wallet,
  CreditCard,
  X,
  Phone,
  Flame,
  Leaf,
} from "lucide-react";
import clsx from "clsx";

const RESTAURANTS = byCategory("food");

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

export default function FoodPage() {
  const activeOrder = useFoodOrderStore((s) => s.activeOrder);
  const placeOrder = useFoodOrderStore((s) => s.placeOrder);
  const cancelOrder = useFoodOrderStore((s) => s.cancelOrder);
  const ratePartner = useFoodOrderStore((s) => s.ratePartner);
  const clearOrder = useFoodOrderStore((s) => s.clearOrder);

  const createDraft = useAppStore((s) => s.createDraft);
  const authorizeTransaction = useAppStore((s) => s.authorizeTransaction);
  const walletBalance = useAppStore((s) => s.walletBalance);
  const paymentMethods = useAppStore((s) => s.paymentMethods);

  const [address, setAddress] = useState("Home");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [source, setSource] = useState<string | undefined>(undefined);
  const [error, setError] = useState("");

  if (activeOrder && activeOrder.phase !== "cancelled") {
    return <FoodTracker onDone={clearOrder} onCancel={cancelOrder} onRate={ratePartner} />;
  }

  function total(itemPrice: number) {
    return itemPrice + DELIVERY_FEE + PLATFORM_FEE;
  }

  function handleConfirm(item: (typeof RESTAURANTS)[number]) {
    const fare = total(item.price);
    const defaultSource = source ?? (walletBalance >= fare ? "wallet" : paymentMethods.find((m) => m.isDefault)?.id ?? paymentMethods[0]?.id);
    if (!defaultSource) {
      setError("no_payment");
      return;
    }
    const tx = createDraft({ ...item, price: fare }, "ORDER");
    const result = authorizeTransaction(tx.id, defaultSource);
    if (!result.ok) {
      setError("no_payment");
      return;
    }
    setError("");
    setConfirmingId(null);
    placeOrder({ itemTitle: item.title, restaurantName: item.providerName, address, fare, transactionId: tx.id });
  }

  return (
    <div className="px-5 pt-6 pb-8">
      <Link href="/explore" className="inline-flex items-center gap-1 text-sm text-ink/50 hover:text-ink">
        <ChevronLeft size={16} /> Explore
      </Link>

      <h1 className="mt-2 text-2xl font-semibold text-ink">Order food 🍜</h1>
      <p className="text-sm text-ink/45">Hungry? Let's get something delicious moving.</p>

      <div className="mt-3 flex items-center gap-2 rounded-xl2 border border-black/10 bg-white p-2.5 shadow-sm">
        <MapPin size={14} className="shrink-0 text-accentDark" />
        <span className="text-xs text-ink/40">Deliver to</span>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="flex-1 bg-transparent text-sm font-medium text-ink outline-none"
        />
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {ADDRESS_SUGGESTIONS.map((a) => (
          <button
            key={a}
            onClick={() => setAddress(a)}
            className="rounded-full border border-black/10 bg-white px-2.5 py-0.5 text-[11px] text-ink/60 hover:border-accentDark"
          >
            {a}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {RESTAURANTS.map((item) => {
          const veg = item.attributes.veg === true;
          const fare = total(item.price);
          const defaultSource = source ?? (walletBalance >= fare ? "wallet" : paymentMethods.find((m) => m.isDefault)?.id ?? paymentMethods[0]?.id);
          const hasAnyPaymentOption = walletBalance >= fare || paymentMethods.length > 0;

          return (
            <div key={item.id} className="overflow-hidden rounded-xl2 border border-black/10 bg-white shadow-sm">
              <div className="flex items-start gap-3 p-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-200 to-orange-300 text-2xl">
                  🍽️
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{item.providerName}</p>
                  <p className="truncate text-xs text-ink/50">{item.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-ink/45">
                    <span className="inline-flex items-center gap-0.5">
                      <Star size={10} className="fill-accent text-accent" /> {item.rating}
                    </span>
                    <span>{item.etaMinutes} min</span>
                    <span className="inline-flex items-center gap-0.5">
                      {veg ? <Leaf size={10} className="text-emerald-600" /> : <Flame size={10} className="text-red-500" />}
                      {String(item.attributes.cuisine)}
                    </span>
                  </div>
                </div>
                <p className="text-sm font-bold text-ink">₹{item.price}</p>
              </div>

              <div className="border-t border-black/5 px-3 py-2">
                {confirmingId !== item.id ? (
                  <button
                    onClick={() => setConfirmingId(item.id)}
                    className="w-full rounded-full bg-accent py-2 text-xs font-bold text-ink hover:brightness-95"
                  >
                    Order now · ₹{fare}
                  </button>
                ) : (
                  <div className="space-y-2 rounded-xl bg-accentSoft p-2.5">
                    <p className="text-[11px] text-ink/60">
                      Item ₹{item.price} + Delivery ₹{DELIVERY_FEE} + Fee ₹{PLATFORM_FEE} = <strong>₹{fare}</strong>
                    </p>
                    {error === "no_payment" && (
                      <p className="text-[11px] text-red-600">
                        No balance or card —{" "}
                        <Link href="/wallet" className="underline">
                          add one
                        </Link>
                        .
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => setSource("wallet")}
                        disabled={walletBalance < fare}
                        className={clsx(
                          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium disabled:cursor-not-allowed disabled:opacity-40",
                          defaultSource === "wallet" ? "border-ink bg-ink text-white" : "border-black/15 bg-white text-ink/70"
                        )}
                      >
                        <Wallet size={10} /> Wallet ₹{walletBalance.toLocaleString("en-IN")}
                      </button>
                      {paymentMethods.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setSource(m.id)}
                          className={clsx(
                            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                            defaultSource === m.id ? "border-ink bg-ink text-white" : "border-black/15 bg-white text-ink/70"
                          )}
                        >
                          <CreditCard size={10} /> {BRAND_LABEL[m.brand]} •••• {m.last4}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleConfirm(item)}
                        disabled={!hasAnyPaymentOption}
                        className="rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-ink disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Confirm & pay ₹{fare}
                      </button>
                      <button
                        onClick={() => {
                          setConfirmingId(null);
                          setError("");
                        }}
                        className="px-3 py-1.5 text-xs text-ink/50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const FOOD_COPY: Record<string, { title: string; sub: string }> = {
  placed: { title: "Order placed! 🎉", sub: "Waiting for the restaurant to confirm" },
  preparing: { title: "Cooking it up 👨‍🍳", sub: "Your food is being prepared" },
  assigned: { title: "Rider's on the way to pick up", sub: "" },
  picked_up: { title: "On the way to you 🛵💨", sub: "" },
  delivered: { title: "Delivered! Enjoy 😋", sub: "" },
};

function FoodTracker({
  onDone,
  onCancel,
  onRate,
}: {
  onDone: () => void;
  onCancel: () => void;
  onRate: (n: number) => void;
}) {
  const order = useFoodOrderStore((s) => s.activeOrder)!;
  const copy = FOOD_COPY[order.phase] ?? FOOD_COPY.placed;

  const progress =
    order.phase === "placed"
      ? 0
      : order.phase === "preparing"
        ? 0.1
        : order.phase === "assigned"
          ? 0.3
          : order.phase === "picked_up"
            ? 0.75
            : 1;

  if (order.phase === "delivered") {
    return (
      <div className="fixed inset-0 z-30 mx-auto flex max-w-md flex-col bg-gradient-to-b from-[#171106] via-[#0e0a03] to-black px-6 py-10 text-white">
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <p className="text-4xl">😋</p>
          <h1 className="text-2xl font-bold">{copy.title}</h1>

          <div className="mt-4 w-full rounded-xl2 bg-white/5 p-4 text-left">
            <div className="flex justify-between text-sm">
              <span className="text-white/50">{order.restaurantName}</span>
              <span className="font-semibold">₹{order.fare.toLocaleString("en-IN")}</span>
            </div>
            <p className="mt-1 truncate text-xs text-white/40">{order.itemTitle} → {order.address}</p>
          </div>

          <p className="mt-2 text-sm text-white/60">Rate {order.partner?.name ?? "your delivery partner"}</p>
          <StarRow value={order.partnerRating ?? 0} onRate={onRate} />
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
        {order.phase !== "picked_up" && (
          <button onClick={onCancel} className="flex h-8 w-8 items-center justify-center rounded-full bg-ink/5 text-ink/50 hover:text-red-500">
            <X size={16} />
          </button>
        )}
      </div>
      {copy.sub && <p className="text-sm text-ink/45">{copy.sub}</p>}

      <div className="mt-3">
        <LiveTrackMap progress={progress} icon={Bike} fromLabel={order.restaurantName} toLabel={order.address} />
      </div>

      {(order.phase === "placed" || order.phase === "preparing") && (
        <div className="mt-6 flex flex-col items-center gap-3 py-6">
          <motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ repeat: Infinity, duration: 1.4 }}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-accentSoft text-2xl"
          >
            🍳
          </motion.div>
        </div>
      )}

      <AnimatePresence>
        {order.partner && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-xl2 border border-black/10 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accentSoft text-base font-semibold text-accentDark">
                {order.partner.name.slice(0, 1)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{order.partner.name}</p>
                <p className="text-xs text-ink/45">{order.partner.vehicle}</p>
              </div>
              <p className="inline-flex items-center gap-1 text-xs font-medium text-ink/60">
                <Star size={11} className="fill-accent text-accent" /> {order.partner.rating}
              </p>
              <button className="flex h-9 w-9 items-center justify-center rounded-full bg-ink/5 text-ink/50">
                <Phone size={14} />
              </button>
            </div>
            {order.etaMinutes !== null && order.phase === "assigned" && (
              <p className="mt-2 text-xs text-ink/50">Arriving in ~{order.etaMinutes} min</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-4 rounded-xl2 bg-ink/5 p-3">
        <p className="text-xs text-ink/50">₹{order.fare.toLocaleString("en-IN")} · {order.itemTitle}</p>
      </div>
    </div>
  );
}
