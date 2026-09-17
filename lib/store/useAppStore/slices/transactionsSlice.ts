import { StateCreator } from "zustand";
import { Transaction, TransactionStatus } from "@/lib/types";
import { BRAND_LABEL } from "@/lib/payments";
import { AppState, TransactionsSlice } from "../types";
import { uid, LIFECYCLES } from "../helpers";

export const createTransactionsSlice: StateCreator<AppState, [], [], TransactionsSlice> = (set, get) => ({
  transactions: [],

  createDraft: (item, type) => {
    const now = Date.now();
    const tx: Transaction = {
      id: uid("txn"),
      type,
      status: "draft",
      itemId: item.id,
      itemTitle: item.title,
      providerName: item.providerName,
      amount: item.price,
      currency: "INR",
      createdAt: now,
      updatedAt: now,
      history: [{ status: "draft", at: now }],
    };
    set((s) => ({ transactions: [tx, ...s.transactions] }));
    get().logAudit({
      actorType: "AI_AGENT",
      action: "draft_created",
      resourceType: type.toLowerCase(),
      resourceId: tx.id,
      policyDecision: "allowed",
      detail: `Draft ${type.toLowerCase()} for ${item.title} — no financial commitment (PRD §8).`,
    });
    return tx;
  },

  authorizeTransaction: (id, source) => {
    const tx = get().transactions.find((t) => t.id === id);
    if (!tx || tx.status !== "draft") return { ok: false as const, reason: "not_draft" as const };

    const useWallet = source === "wallet";
    let sourceLabel: string;

    if (useWallet) {
      if (get().walletBalance < tx.amount) {
        get().logAudit({
          actorType: "USER",
          action: "purchase_blocked",
          resourceType: tx.type.toLowerCase(),
          resourceId: tx.id,
          policyDecision: "blocked",
          detail: `Insufficient wallet balance for ₹${tx.amount} (PRD §8 policy check).`,
        });
        return { ok: false as const, reason: "insufficient_balance" as const };
      }
      sourceLabel = "Wallet balance";
    } else {
      const methods = get().paymentMethods;
      const method = source
        ? methods.find((m) => m.id === source)
        : methods.find((m) => m.isDefault) ?? methods[0];

      if (!method) {
        get().logAudit({
          actorType: "USER",
          action: "purchase_blocked",
          resourceType: tx.type.toLowerCase(),
          resourceId: tx.id,
          policyDecision: "blocked",
          detail: "No payment method on file (PRD §8 policy check).",
        });
        return { ok: false as const, reason: "no_payment_method" as const };
      }
      sourceLabel = `${BRAND_LABEL[method.brand]} •••• ${method.last4}`;
    }

    const now = Date.now();
    const nextStatus: TransactionStatus = tx.type === "ORDER" ? "pending_vendor" : "confirmed";

    set((s) => ({
      transactions: s.transactions.map((t) =>
        t.id === id
          ? {
              ...t,
              status: nextStatus,
              updatedAt: now,
              meta: { ...t.meta, card: sourceLabel },
              history: [...t.history, { status: nextStatus, at: now }],
            }
          : t
      ),
      walletBalance: useWallet ? s.walletBalance - tx.amount : s.walletBalance,
      ledger: [
        {
          id: uid("ledg"),
          transactionId: tx.id,
          amount: tx.amount,
          direction: "debit",
          note: `${tx.type} · ${tx.itemTitle}`,
          sourceLabel,
          at: now,
        },
        ...s.ledger,
      ],
    }));
    get().logAudit({
      actorType: "USER",
      action: "purchase_authorized",
      resourceType: tx.type.toLowerCase(),
      resourceId: tx.id,
      policyDecision: "allowed",
      detail: `User explicitly confirmed ₹${tx.amount} for ${tx.itemTitle} on ${sourceLabel} (PRD §8).`,
    });
    return { ok: true as const };
  },

  cancelTransaction: (id) => {
    const now = Date.now();
    set((s) => ({
      transactions: s.transactions.map((t) =>
        t.id === id
          ? { ...t, status: "cancelled", updatedAt: now, history: [...t.history, { status: "cancelled", at: now }] }
          : t
      ),
    }));
    get().logAudit({
      actorType: "USER",
      action: "transaction_cancelled",
      resourceType: "transaction",
      resourceId: id,
      policyDecision: "allowed",
    });
  },

  advanceTransaction: (id) => {
    const tx = get().transactions.find((t) => t.id === id);
    if (!tx) return;
    const path = LIFECYCLES[tx.type];
    if (!path) return; // RIDE has its own real state machine — see slices/rideSlice.ts
    const idx = path.indexOf(tx.status);
    if (idx === -1 || idx >= path.length - 1) return;
    const next = path[idx + 1];
    const now = Date.now();
    set((s) => ({
      transactions: s.transactions.map((t) =>
        t.id === id ? { ...t, status: next, updatedAt: now, history: [...t.history, { status: next, at: now }] } : t
      ),
    }));
  },
});
