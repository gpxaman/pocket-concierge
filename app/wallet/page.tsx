"use client";

import PaymentsPanel from "@/components/PaymentsPanel";

export default function WalletPage() {
  return (
    <div className="px-5 pt-6 pb-8">
      <p className="text-xs font-medium uppercase tracking-wide text-accentDark">Payments</p>
      <h1 className="mt-1 text-2xl font-semibold text-ink">Balance, cards & history</h1>
      <div className="mt-5">
        <PaymentsPanel />
      </div>
    </div>
  );
}
