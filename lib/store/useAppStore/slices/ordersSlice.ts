import { StateCreator } from "zustand";
import { Transaction } from "@/lib/types";
import { findById } from "@/lib/data/catalog";
import { priceCart } from "@/lib/pricing";
import { pointsForAmount } from "@/lib/loyalty";
import { BRAND_LABEL } from "@/lib/payments";
import { AppState, OrdersSlice } from "../types";
import { uid, etaMinutesFor } from "../helpers";

export const createOrdersSlice: StateCreator<AppState, [], [], OrdersSlice> = (set, get) => ({
  placeOrderFromCart: (source, opts) => {
    const cart = get().cart;
    if (cart.length === 0) return { ok: false as const, reason: "empty_cart" as const };

    const lineItems: Transaction["items"] = cart
      .map((c) => {
        const item = findById(c.itemId);
        return item
          ? { itemId: item.id, title: item.title, providerName: item.providerName, qty: c.qty, price: item.price }
          : null;
      })
      .filter((i): i is NonNullable<typeof i> => i !== null);

    if (lineItems.length === 0) return { ok: false as const, reason: "empty_cart" as const };

    // Total includes delivery/platform/GST — matches exactly what the manual
    // checkout page (and the AI agent's place_order) shows before confirming.
    const total = priceCart(cart).total;
    const useWallet = source === "wallet";

    let sourceLabel: string;
    if (useWallet) {
      if (get().walletBalance < total) {
        get().logAudit({
          actorType: "AI_AGENT",
          action: "purchase_blocked",
          resourceType: "order",
          policyDecision: "blocked",
          detail: `Insufficient wallet balance for ₹${total} order (PRD §8 policy check).`,
        });
        return { ok: false as const, reason: "insufficient_balance" as const };
      }
      sourceLabel = "Wallet balance";
    } else {
      const methods = get().paymentMethods;
      const method = methods.find((m) => m.id === source) ?? methods.find((m) => m.isDefault) ?? methods[0];
      if (!method) return { ok: false as const, reason: "no_payment_method" as const };
      sourceLabel = `${BRAND_LABEL[method.brand]} •••• ${method.last4}`;
    }

    const now = Date.now();
    const providerNames = Array.from(new Set(lineItems.map((i) => i.providerName)));
    const titleSummary =
      lineItems.length === 1
        ? lineItems[0].title
        : `${lineItems.reduce((n, i) => n + i.qty, 0)} items from ${providerNames.join(", ")}`;

    const tx: Transaction = {
      id: uid("txn"),
      type: "ORDER",
      status: "pending_vendor",
      itemId: lineItems[0].itemId,
      itemTitle: titleSummary,
      providerName: providerNames.join(", "),
      amount: total,
      currency: "INR",
      createdAt: now,
      updatedAt: now,
      meta: { card: sourceLabel },
      history: [
        { status: "draft", at: now },
        { status: "pending_vendor", at: now },
      ],
      items: lineItems,
      etaMinutes: etaMinutesFor(cart),
      placedBy: opts?.placedBy ?? "AI_AGENT",
    };

    set((s) => ({
      transactions: [tx, ...s.transactions],
      walletBalance: useWallet ? s.walletBalance - total : s.walletBalance,
      cart: [],
      points: s.points + pointsForAmount(total),
      ledger: [
        {
          id: uid("ledg"),
          transactionId: tx.id,
          amount: total,
          direction: "debit",
          note: `ORDER · ${titleSummary}`,
          sourceLabel,
          at: now,
        },
        ...s.ledger,
      ],
    }));

    get().logAudit({
      actorType: "USER",
      action: "purchase_authorized",
      resourceType: "order",
      resourceId: tx.id,
      policyDecision: "allowed",
      detail: `User confirmed ₹${total} order via the AI concierge, charged to ${sourceLabel} (PRD §8).`,
    });
    get().logAudit({
      actorType: "AI_AGENT",
      action: "order_placed",
      resourceType: "order",
      resourceId: tx.id,
      policyDecision: "allowed",
      detail: `Placed order for ${titleSummary} — ₹${total}.`,
    });

    return { ok: true as const, transaction: tx };
  },
});
