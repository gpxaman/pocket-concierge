"use client";

import { useAppStore } from "@/lib/store/useAppStore";
import StatusBadge from "@/components/StatusBadge";
import { ReceiptText } from "lucide-react";

export default function OrderHistory() {
  const transactions = useAppStore((s) => s.transactions);

  const orderHistory = transactions
    .filter((t) => t.status !== "draft")
    .sort((a, b) => b.updatedAt - a.updatedAt);

  return (
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
  );
}
