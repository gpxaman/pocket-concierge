"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store/useAppStore";
import { BRAND_LABEL, isValidCardNumber, isValidExpiry } from "@/lib/payments";
import { CreditCard, Plus, Trash2, Check } from "lucide-react";
import clsx from "clsx";

const BRAND_GRADIENT: Record<string, string> = {
  visa: "from-[#1a1a2e] to-[#3949ab]",
  mastercard: "from-[#2b0f0f] to-[#c94b4b]",
  amex: "from-[#0f2b2b] to-[#0d8a8a]",
  rupay: "from-[#1f1435] to-[#7c3aed]",
  card: "from-[#1a1a1a] to-[#4b4b4b]",
};

export default function SavedCards() {
  const paymentMethods = useAppStore((s) => s.paymentMethods);
  const addPaymentMethod = useAppStore((s) => s.addPaymentMethod);
  const removePaymentMethod = useAppStore((s) => s.removePaymentMethod);
  const setDefaultPaymentMethod = useAppStore((s) => s.setDefaultPaymentMethod);

  const [showForm, setShowForm] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [holderName, setHolderName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [error, setError] = useState("");

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

  return (
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
  );
}
