import { StateCreator } from "zustand";
import { BRAND_LABEL } from "@/lib/payments";
import { AppState, WalletSlice } from "../types";
import { uid } from "../helpers";

export const createWalletSlice: StateCreator<AppState, [], [], WalletSlice> = (set, get) => ({
  walletBalance: 0,
  ledger: [],

  addBalance: (amount, viaCardId) => {
    const now = Date.now();
    const card = viaCardId ? get().paymentMethods.find((m) => m.id === viaCardId) : undefined;
    const sourceLabel = card ? `${BRAND_LABEL[card.brand]} •••• ${card.last4}` : "Bank transfer";
    set((s) => ({
      walletBalance: s.walletBalance + amount,
      ledger: [
        {
          id: uid("ledg"),
          transactionId: uid("topup"),
          amount,
          direction: "credit",
          note: `Added money via ${sourceLabel}`,
          sourceLabel,
          at: now,
        },
        ...s.ledger,
      ],
    }));
    get().logAudit({
      actorType: "USER",
      action: "balance_topped_up",
      resourceType: "wallet",
      policyDecision: "allowed",
      detail: `Added ₹${amount.toLocaleString("en-IN")} via ${sourceLabel}.`,
    });
  },
});
