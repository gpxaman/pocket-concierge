"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store/useAppStore";
import { BRAND_LABEL, isValidCardNumber, isValidExpiry } from "@/lib/payments";
import StatusBadge from "@/components/StatusBadge";
import { CreditCard, Plus, Trash2, Check, ReceiptText, Wallet, Landmark } from "lucide-react";
import clsx from "clsx";

const TOPUP_PRESETS = [500, 1000, 2000, 5000];

const BRAND_GRADIENT: Record<string, string> = {
  visa: "from-[#1a1a2e] to-[#3949ab]",
  mastercard: "from-[#2b0f0f] to-[#c94b4b]",
  amex: "from-[#0f2b2b] to-[#0d8a8a]",
  rupay: "from-[#1f1435] to-[#7c3aed]",
  card: "from-[#1a1a1a] to-[#4b4b4b]",
};

export default function PaymentsPanel() {
  const paymentMethods = useAppStore((s) => s.paymentMethods);
  const addPaymentMethod = useAppStore((s) => s.addPaymentMethod);
  const removePaymentMethod = useAppStore((s) => s.removePaymentMethod);
  const setDefaultPaymentMethod = useAppStore((s) => s.setDefaultPaymentMethod);
  const walletBalance = useAppStore((s) => s.walletBalance);
  const addBalance = useAppStore((s) => s.addBalance);
  const transactions = useAppStore((s) => s.transactions);

  const [showForm, setShowForm] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [holderName, setHolderName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [error, setError] = useState("");

  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpSource, setTopUpSource] = useState<string | undefined>(undefined);

  const orderHistory = transactions
    .filter((t) => t.status !== "draft")
    .sort((a, b) => b.updatedAt - a.updatedAt);

  function submitCard(e: React.FormEvent) {
    e.preventDefault();
    if (!holderName.trim()) return setError("Enter the name on the card.");
    if (!isValidCardNumber(cardNumber)) return setError("Enter a valid card number.");
    if (!isValidExpiry(expiry)) return setError("Enter a valid, non-expired MM/YY.");
    addPaymentMethod({ cardNumber, holderName: holderName.trim(), expiry });
    setCardNumber("");
    setHolderName("");
    setExpiry("");
    setError("");
    setShowForm(false);
  }

  function submitTopUp(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(topUpAmount);
    if (!amount || amount <= 0) return;
    addBalance(amount, topUpSource);
    setTopUpAmount("");
    setShowTopUp(false);
  }

  return (
    <div>
      <section>
        <div className="rounded-xl2 bg-gradient-to-br from-accent to-[#e0a800] p-5 text-ink shadow-sm">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink/60">
              <Wallet size={14} /> Wallet balance
            </span>
          </div>
          <p className="mt-2 text-3xl font-bold">₹{walletBalance.toLocaleString("en-IN")}</p>
          {!showTopUp && (
            <button
              onClick={() => setShowTopUp(true)}
              className="mt-3 inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink/85"
            >
              <Plus size={13} /> Add money
            </button>
          )}
        </div>

        {showTopUp && (
          <form onSubmit={submitTopUp} className="mt-3 space-y-2.5 rounded-xl2 border border-black/10 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap gap-1.5">
              {TOPUP_PRESETS.map((v) => (
                <button
                  type="button"
                  key={v}
                  onClick={() => setTopUpAmount(String(v))}
                  className={clsx(
                    "rounded-full border px-2.5 py-1 text-xs font-medium transition",
                    topUpAmount === String(v)
                      ? "border-ink bg-ink text-white"
                      : "border-black/15 text-ink/70 hover:border-ink/40"
                  )}
                >
                  ₹{v.toLocaleString("en-IN")}
                </button>
              ))}
            </div>
            <input
              value={topUpAmount}
              onChange={(e) => setTopUpAmount(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="Custom amount"
              inputMode="numeric"
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-accentDark"
            />

            <div>
              <p className="mb-1.5 text-xs font-medium text-ink/50">Funding source</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setTopUpSource(undefined)}
                  className={clsx(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                    topUpSource === undefined
                      ? "border-ink bg-ink text-white"
                      : "border-black/15 text-ink/70 hover:border-ink/40"
                  )}
                >
                  <Landmark size={11} /> Bank transfer
                </button>
                {paymentMethods.map((m) => (
                  <button
                    type="button"
                    key={m.id}
                    onClick={() => setTopUpSource(m.id)}
                    className={clsx(
                      "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                      topUpSource === m.id
                        ? "border-ink bg-ink text-white"
                        : "border-black/15 text-ink/70 hover:border-ink/40"
                    )}
                  >
                    <CreditCard size={11} /> {BRAND_LABEL[m.brand]} •••• {m.last4}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={!Number(topUpAmount)}
                className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-ink hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Add ₹{Number(topUpAmount || 0).toLocaleString("en-IN")}
              </button>
              <button
                type="button"
                onClick={() => setShowTopUp(false)}
                className="rounded-full px-3 py-1.5 text-xs text-ink/50 hover:text-ink"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink/70">Your cards</h2>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-white hover:bg-ink/85"
            >
              <Plus size={13} /> Add card
            </button>
          )}
        </div>

        {paymentMethods.length === 0 && !showForm && (
          <div className="mt-3 flex flex-col items-center gap-2 rounded-xl2 border border-dashed border-black/15 py-8 text-center text-ink/40">
            <CreditCard size={24} />
            <p className="text-sm">No cards saved yet — add one to check out.</p>
          </div>
        )}

        <div className="mt-3 space-y-3">
          {paymentMethods.map((m) => (
            <div
              key={m.id}
              className={clsx(
                "relative overflow-hidden rounded-xl2 bg-gradient-to-br p-4 text-white shadow-sm",
                BRAND_GRADIENT[m.brand]
              )}
            >
              <div className="flex items-start justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-white/70">{BRAND_LABEL[m.brand]}</span>
                {m.isDefault && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium">
                    <Check size={10} /> Default
                  </span>
                )}
              </div>
              <p className="mt-3 font-mono text-lg tracking-widest">•••• •••• •••• {m.last4}</p>
              <div className="mt-2 flex items-center justify-between text-xs text-white/70">
                <span className="truncate">{m.holderName}</span>
                <span>{m.expiry}</span>
              </div>
              <div className="mt-3 flex gap-2">
                {!m.isDefault && (
                  <button
                    onClick={() => setDefaultPaymentMethod(m.id)}
                    className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] hover:bg-white/25"
                  >
                    Make default
                  </button>
                )}
                <button
                  onClick={() => removePaymentMethod(m.id)}
                  className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] hover:bg-white/25"
                >
                  <Trash2 size={11} /> Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        {showForm && (
          <form onSubmit={submitCard} className="mt-3 space-y-2 rounded-xl2 border border-black/10 bg-white p-4 shadow-sm">
            <input
              value={holderName}
              onChange={(e) => setHolderName(e.target.value)}
              placeholder="Name on card"
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-accentDark"
            />
            <input
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
              placeholder="Card number"
              inputMode="numeric"
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-accentDark"
            />
            <input
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              placeholder="MM/YY"
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-accentDark"
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <p className="text-[10px] text-ink/40">
              Demo only — the full number is never stored, only the brand and last 4 digits (TRD §6.2).
            </p>
            <div className="flex gap-2 pt-1">
              <button type="submit" className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-ink hover:brightness-95">
                Save card
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setError("");
                }}
                className="rounded-full px-3 py-1.5 text-xs text-ink/50 hover:text-ink"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="mt-8">
        <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink/70">
          <ReceiptText size={15} /> Order history
        </h2>
        <p className="text-[11px] text-ink/40">Every past order, booking and ride — read-only.</p>

        {orderHistory.length === 0 ? (
          <p className="mt-4 text-sm text-ink/40">Nothing here yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {orderHistory.map((t) => (
              <div key={t.id} className="rounded-xl2 border border-black/5 bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{t.itemTitle}</p>
                    <p className="text-xs text-ink/45">{t.providerName} · {t.type}</p>
                  </div>
                  <StatusBadge status={t.status} />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-xs text-ink/45">
                  <span>{t.meta?.card ?? "—"}</span>
                  <span>{new Date(t.updatedAt).toLocaleDateString()}</span>
                </div>
                <p className="mt-1 text-sm font-semibold text-ink">₹{t.amount.toLocaleString("en-IN")}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
