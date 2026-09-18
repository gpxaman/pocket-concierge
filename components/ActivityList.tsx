"use client";

import { useState } from "react";
import Link from "next/link";
import { useAppStore, PaymentSource } from "@/lib/store/useAppStore";
import { BRAND_LABEL } from "@/lib/payments";
import StatusBadge from "@/components/StatusBadge";
import { ListChecks, ShieldCheck, X, PlayCircle, Wallet, CreditCard, Navigation } from "lucide-react";
import clsx from "clsx";

export default function ActivityList() {
  const transactions = useAppStore((s) => s.transactions);
  const paymentMethods = useAppStore((s) => s.paymentMethods);
  const walletBalance = useAppStore((s) => s.walletBalance);
  const activeRide = useAppStore((s) => s.activeRide);
  const authorizeTransaction = useAppStore((s) => s.authorizeTransaction);
  const cancelTransaction = useAppStore((s) => s.cancelTransaction);
  const advanceTransaction = useAppStore((s) => s.advanceTransaction);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [sourceById, setSourceById] = useState<Record<string, PaymentSource>>({});

  const defaultCard = paymentMethods.find((m) => m.isDefault) ?? paymentMethods[0];

  function sourceFor(txId: string, amount: number): PaymentSource | undefined {
    if (sourceById[txId]) return sourceById[txId];
    if (walletBalance >= amount) return "wallet";
    return defaultCard?.id;
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center text-ink/40">
        <ListChecks size={28} />
        <p className="text-sm">Nothing yet. Add something to a draft from the AI tab or Explore.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {transactions.map((t) => {
        const selected = sourceFor(t.id, t.amount);
        const hasAnyOption = walletBalance >= t.amount || paymentMethods.length > 0;

        return (
          <div key={t.id} className="rounded-xl2 border border-black/5 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-ink">{t.itemTitle}</p>
                <p className="text-xs text-ink/50">{t.providerName} · {t.type}</p>
              </div>
              <StatusBadge status={t.status} />
            </div>

            <p className="mt-2 text-sm font-medium text-ink">₹{t.amount.toLocaleString("en-IN")}</p>
            {t.meta?.card && (
              <p className="text-xs text-ink/40">
                {/* Rides charge on completion, not on request — meta.card is only the chosen source until then. */}
                {t.type === "RIDE" && t.status !== "completed" ? "Paying with" : "Charged to"} {t.meta.card}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {t.status === "draft" && confirmingId !== t.id && (
                <>
                  <button
                    onClick={() => setConfirmingId(t.id)}
                    className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-ink hover:brightness-95"
                  >
                    <ShieldCheck size={13} /> Authorize & pay
                  </button>
                  <button
                    onClick={() => cancelTransaction(t.id)}
                    className="inline-flex items-center gap-1 rounded-full border border-black/10 px-3 py-1.5 text-xs text-ink/60 hover:border-red-300 hover:text-red-500"
                  >
                    <X size={13} /> Discard draft
                  </button>
                </>
              )}

              {t.status === "draft" && confirmingId === t.id && (
                <div className="w-full rounded-xl bg-accentSoft p-3">
                  <p className="text-xs text-ink/70">
                    Confirm ₹{t.amount.toLocaleString("en-IN")} to {t.providerName}? This is the explicit
                    authorization step the AI can never skip (PRD §8).
                  </p>

                  {hasAnyOption ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <button
                        onClick={() => setSourceById((s) => ({ ...s, [t.id]: "wallet" }))}
                        disabled={walletBalance < t.amount}
                        className={clsx(
                          "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40",
                          selected === "wallet"
                            ? "border-ink bg-ink text-white"
                            : "border-black/15 bg-white text-ink/70 hover:border-ink/40"
                        )}
                      >
                        <Wallet size={11} /> Wallet ₹{walletBalance.toLocaleString("en-IN")}
                      </button>
                      {paymentMethods.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setSourceById((s) => ({ ...s, [t.id]: m.id }))}
                          className={clsx(
                            "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                            selected === m.id
                              ? "border-ink bg-ink text-white"
                              : "border-black/15 bg-white text-ink/70 hover:border-ink/40"
                          )}
                        >
                          <CreditCard size={11} /> {BRAND_LABEL[m.brand]} •••• {m.last4}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1.5 text-xs text-red-600">
                      No balance or card on file —{" "}
                      <Link href="/wallet" className="underline">
                        add money or a card
                      </Link>{" "}
                      first.
                    </p>
                  )}

                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => {
                        const result = authorizeTransaction(t.id, selected);
                        if (result.ok) {
                          setConfirmingId(null);
                          setErrorId(null);
                        } else {
                          setErrorId(t.id);
                        }
                      }}
                      disabled={!hasAnyOption || !selected}
                      className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-ink hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Confirm ₹{t.amount.toLocaleString("en-IN")}
                    </button>
                    <button
                      onClick={() => {
                        setConfirmingId(null);
                        setErrorId(null);
                      }}
                      className="rounded-full px-3 py-1.5 text-xs text-ink/50 hover:text-ink"
                    >
                      Back
                    </button>
                  </div>
                  {errorId === t.id && (
                    <p className="mt-2 text-xs font-medium text-red-600">
                      Couldn&apos;t authorize — check your balance or card and try again.
                    </p>
                  )}
                </div>
              )}

              {t.type === "RIDE" && activeRide?.transactionId === t.id ? (
                <Link
                  href="/explore/rides"
                  className="inline-flex items-center gap-1 rounded-full border border-black/10 px-3 py-1.5 text-xs text-ink/60 hover:border-accentDark hover:text-accentDark"
                >
                  <Navigation size={13} /> Track ride
                </Link>
              ) : (
                t.type !== "RIDE" &&
                !["draft", "completed", "cancelled"].includes(t.status) && (
                  <button
                    onClick={() => advanceTransaction(t.id)}
                    className="inline-flex items-center gap-1 rounded-full border border-black/10 px-3 py-1.5 text-xs text-ink/60 hover:border-accentDark hover:text-accentDark"
                  >
                    <PlayCircle size={13} /> Simulate next step
                  </button>
                )
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
