"use client";

import WalletCard from "@/components/payments/WalletCard";
import SavedCards from "@/components/payments/SavedCards";
import OrderHistory from "@/components/payments/OrderHistory";

export default function PaymentsPanel() {
  return (
    <div>
      <WalletCard />
      <SavedCards />
      <OrderHistory />
    </div>
  );
}
