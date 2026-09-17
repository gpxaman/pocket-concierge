"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store/useAppStore";
import { BRAND_LABEL } from "@/lib/payments";
import { CreditCard, Plus, Wallet, Landmark } from "lucide-react";
import clsx from "clsx";

const TOPUP_PRESETS = [500, 1000, 2000, 5000];

export default function WalletCard() {
  const walletBalance = useAppStore((s) => s.walletBalance);
  const addBalance = useAppStore((s) => s.addBalance);
  const paymentMethods = useAppStore((s) => s.paymentMethods);

  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpSource, setTopUpSource] = useState<string | undefined>(undefined);

  function submitTopUp(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(topUpAmount);
    if (!amount || amount <= 0) return;
    addBalance(amount, topUpSource);
    setTopUpAmount("");
    setShowTopUp(false);
  }

  return (
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
  );
}
