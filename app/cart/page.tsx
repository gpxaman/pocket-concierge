"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ShoppingBag, Wallet, CreditCard } from "lucide-react";
import clsx from "clsx";
import { useAppStore, PaymentSource } from "@/lib/store/useAppStore";
import { findById } from "@/lib/data/catalog";
import { findRestaurant } from "@/lib/data/restaurants";
import { priceCart } from "@/lib/pricing";
import { BRAND_LABEL } from "@/lib/payments";
import QtyStepper from "@/components/QtyStepper";
import BillSummary from "@/components/BillSummary";

export default function CartPage() {
  const router = useRouter();
  const cart = useAppStore((s) => s.cart);
  const walletBalance = useAppStore((s) => s.walletBalance);
  const paymentMethods = useAppStore((s) => s.paymentMethods);
  const placeOrderFromCart = useAppStore((s) => s.placeOrderFromCart);

  const lines = useMemo(
    () =>
      cart
        .map((c) => ({ ...c, item: findById(c.itemId) }))
        .filter((l): l is typeof l & { item: NonNullable<typeof l.item> } => Boolean(l.item)),
    [cart]
  );

  const isFood = lines.some((l) => l.item.category === "food");
  const restaurantId = isFood ? lines.find((l) => l.item.category === "food")?.item.providerId : undefined;
  const restaurant = restaurantId ? findRestaurant(restaurantId) : undefined;

  const itemCount = lines.reduce((n, l) => n + l.qty, 0);
  // Same helper useAppStore.placeOrderFromCart and the AI agent's
  // place_order use to compute the real charge — this is exactly what
  // "Place order" below will debit, never just a preview number.
  const { itemTotal, deliveryFee, platformFee, gst, total } = priceCart(cart);

  const defaultCard = paymentMethods.find((m) => m.isDefault) ?? paymentMethods[0];
  const [source, setSource] = useState<PaymentSource | undefined>(walletBalance >= total ? "wallet" : defaultCard?.id);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handlePlaceOrder() {
    if (!source) return;
    setPlacing(true);
    setError(null);
    const result = placeOrderFromCart(source, { placedBy: "USER" });
    setPlacing(false);
    if (result.ok) {
      router.push("/activity");
    } else if (result.reason === "insufficient_balance") {
      setError("Insufficient wallet balance — top up or pick a card.");
    } else if (result.reason === "no_payment_method") {
      setError("No payment method available.");
    } else {
      setError("Your cart is empty.");
    }
  }

  if (lines.length === 0) {
    return (
      <div className="px-5 pt-6 pb-10">
        <Link href="/explore" className="inline-flex items-center gap-1 text-sm text-ink/50 hover:text-ink">
          <ChevronLeft size={16} /> Explore
        </Link>
        <div className="mt-16 flex flex-col items-center gap-2 text-center text-ink/40">
          <ShoppingBag size={28} />
          <p className="text-sm">Your cart is empty. Add something from Food or Grocery.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 pt-6 pb-8">
      <Link href="/explore" className="inline-flex items-center gap-1 text-sm text-ink/50 hover:text-ink">
        <ChevronLeft size={16} /> Continue browsing
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-ink">Your cart</h1>
      {isFood && restaurant ? (
        <p className="mt-1 text-sm text-ink/50">
          From {restaurant.name} · arriving in ~{restaurant.deliveryEtaMinutes} min
        </p>
      ) : (
        <p className="mt-1 text-sm text-ink/50">Arriving in ~10-15 min</p>
      )}

      <div className="mt-4 divide-y divide-black/5 rounded-xl2 border border-black/5 bg-white p-4 shadow-sm">
        {lines.map((l) => (
          <div key={l.itemId} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{l.item.title}</p>
              <p className="text-xs text-ink/45">
                ₹{l.item.price.toLocaleString("en-IN")}
                {l.item.weight ? ` · ${l.item.weight}` : ""}
              </p>
            </div>
            <QtyStepper itemId={l.itemId} />
          </div>
        ))}
      </div>

      <div className="mt-4">
        <BillSummary
          rows={[
            { label: `Item total (${itemCount} item${itemCount > 1 ? "s" : ""})`, amount: itemTotal },
            { label: "Delivery fee", amount: deliveryFee, freeIfZero: true },
            { label: "Platform fee", amount: platformFee },
            { label: "GST and other charges", amount: gst },
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
        onClick={handlePlaceOrder}
        disabled={!source || placing}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3 text-sm font-semibold text-ink transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {placing ? "Placing order…" : `Place order · ₹${total.toLocaleString("en-IN")}`}
      </button>
    </div>
  );
}
