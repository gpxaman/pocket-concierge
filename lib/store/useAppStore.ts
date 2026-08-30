"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  AuditRecord,
  CartItem,
  CatalogItem,
  ChatMessage,
  MemoryItem,
  PaymentMethod,
  Preference,
  Transaction,
  TransactionStatus,
} from "@/lib/types";
import { BRAND_LABEL, detectBrand, last4Of } from "@/lib/payments";
import { cartWithItemAdded, findById } from "@/lib/data/catalog";
import { priceCart } from "@/lib/pricing";

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

interface LedgerEntry {
  id: string;
  transactionId: string;
  amount: number;
  direction: "debit" | "credit";
  note: string;
  sourceLabel: string;
  at: number;
}

/** "wallet" pays from the topped-up balance; any other string is a PaymentMethod id. */
export type PaymentSource = "wallet" | string;

interface AppState {
  transactions: Transaction[];
  memory: MemoryItem[];
  preferences: Preference[];
  audit: AuditRecord[];
  ledger: LedgerEntry[];
  paymentMethods: PaymentMethod[];
  walletBalance: number;
  personalizationEnabled: boolean;
  chatMessages: ChatMessage[];
  displayName: string;
  cart: CartItem[];

  logAudit: (a: Omit<AuditRecord, "id" | "timestamp" | "correlationId"> & { correlationId?: string }) => void;

  createDraft: (item: CatalogItem, type: Transaction["type"]) => Transaction;
  authorizeTransaction: (
    id: string,
    source?: PaymentSource
  ) => { ok: true } | { ok: false; reason: "not_draft" | "no_payment_method" | "insufficient_balance" };
  cancelTransaction: (id: string) => void;
  advanceTransaction: (id: string) => void;

  addBalance: (amount: number, viaCardId?: string) => void;

  addPaymentMethod: (input: { cardNumber: string; holderName: string; expiry: string }) => void;
  removePaymentMethod: (id: string) => void;
  setDefaultPaymentMethod: (id: string) => void;

  addMemory: (fact: string, provenance: MemoryItem["provenance"], confidence?: number) => void;
  deleteMemory: (id: string) => void;
  clearMemory: () => void;
  setPersonalizationEnabled: (v: boolean) => void;

  setPreference: (key: string, value: string) => void;
  deletePreference: (key: string) => void;

  addChatMessage: (m: ChatMessage) => void;
  clearChat: () => void;
  setDisplayName: (name: string) => void;

  /** Returns whether adding this item reset the cart to switch restaurants (single-restaurant-food-cart rule). */
  addToCart: (itemId: string, qty?: number) => { restaurantSwitched: boolean };
  removeFromCart: (itemId: string) => void;
  setCartQty: (itemId: string, qty: number) => void;
  clearCart: () => void;
  setCart: (cart: CartItem[]) => void;
  placeOrderFromCart: (
    source: PaymentSource,
    opts?: { placedBy?: "USER" | "AI_AGENT" }
  ) =>
    | { ok: true; transaction: Transaction }
    | { ok: false; reason: "empty_cart" | "insufficient_balance" | "no_payment_method" };
}

function etaMinutesFor(items: { itemId: string; qty: number }[]): number | undefined {
  const catalogItems = items.map((i) => findById(i.itemId)).filter((i): i is CatalogItem => Boolean(i));
  if (catalogItems.length === 0) return undefined;
  const withEta = catalogItems.filter((i) => typeof i.etaMinutes === "number");
  if (withEta.length > 0) return Math.max(...withEta.map((i) => i.etaMinutes!));
  if (catalogItems.every((i) => i.category === "grocery")) return 120;
  return undefined;
}

const LIFECYCLES: Record<Transaction["type"], TransactionStatus[]> = {
  ORDER: ["draft", "pending_authorization", "pending_vendor", "in_progress", "completed"],
  BOOKING: ["draft", "pending_authorization", "confirmed", "in_progress", "completed"],
  RIDE: ["draft", "pending_authorization", "confirmed", "in_progress", "completed"],
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      transactions: [],
      memory: [],
      preferences: [],
      audit: [],
      ledger: [],
      paymentMethods: [],
      walletBalance: 0,
      personalizationEnabled: true,
      chatMessages: [],
      displayName: "",
      cart: [],

      logAudit: (a) =>
        set((s) => ({
          audit: [
            {
              id: uid("audit"),
              timestamp: Date.now(),
              correlationId: a.correlationId ?? uid("corr"),
              ...a,
            },
            ...s.audit,
          ].slice(0, 200),
        })),

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

      addPaymentMethod: ({ cardNumber, holderName, expiry }) => {
        const method: PaymentMethod = {
          id: uid("pm"),
          brand: detectBrand(cardNumber),
          last4: last4Of(cardNumber),
          expiry,
          holderName,
          isDefault: get().paymentMethods.length === 0,
          createdAt: Date.now(),
        };
        set((s) => ({ paymentMethods: [...s.paymentMethods, method] }));
        get().logAudit({
          actorType: "USER",
          action: "payment_method_added",
          resourceType: "payment_method",
          resourceId: method.id,
          policyDecision: "allowed",
          detail: `${BRAND_LABEL[method.brand]} •••• ${method.last4} added. Card number was never stored (TRD §6.2).`,
        });
      },

      removePaymentMethod: (id) => {
        set((s) => {
          const removed = s.paymentMethods.find((m) => m.id === id);
          const remaining = s.paymentMethods.filter((m) => m.id !== id);
          if (removed?.isDefault && remaining.length > 0) remaining[0] = { ...remaining[0], isDefault: true };
          return { paymentMethods: remaining };
        });
        get().logAudit({
          actorType: "USER",
          action: "payment_method_removed",
          resourceType: "payment_method",
          resourceId: id,
          policyDecision: "allowed",
        });
      },

      setDefaultPaymentMethod: (id) =>
        set((s) => ({
          paymentMethods: s.paymentMethods.map((m) => ({ ...m, isDefault: m.id === id })),
        })),

      addMemory: (fact, provenance, confidence = provenance === "explicit" ? 1 : 0.6) =>
        set((s) => ({
          memory: [
            { id: uid("mem"), fact, provenance, confidence, createdAt: Date.now() },
            ...s.memory,
          ],
        })),
      deleteMemory: (id) => set((s) => ({ memory: s.memory.filter((m) => m.id !== id) })),
      clearMemory: () => set({ memory: [] }),
      setPersonalizationEnabled: (v) => set({ personalizationEnabled: v }),

      setPreference: (key, value) =>
        set((s) => {
          const existing = s.preferences.find((p) => p.key === key);
          const updated: Preference = { key, value, updatedAt: Date.now() };
          return {
            preferences: existing
              ? s.preferences.map((p) => (p.key === key ? updated : p))
              : [...s.preferences, updated],
          };
        }),
      deletePreference: (key) => set((s) => ({ preferences: s.preferences.filter((p) => p.key !== key) })),

      addChatMessage: (m) => set((s) => ({ chatMessages: [...s.chatMessages, m] })),
      clearChat: () => set({ chatMessages: [] }),
      setDisplayName: (name) => set({ displayName: name }),

      addToCart: (itemId, qty = 1) => {
        const { cart, restaurantSwitched } = cartWithItemAdded(get().cart, itemId, qty);
        set({ cart });
        return { restaurantSwitched };
      },
      removeFromCart: (itemId) => set((s) => ({ cart: s.cart.filter((c) => c.itemId !== itemId) })),
      setCartQty: (itemId, qty) =>
        set((s) => ({
          cart: qty <= 0 ? s.cart.filter((c) => c.itemId !== itemId) : s.cart.map((c) => (c.itemId === itemId ? { ...c, qty } : c)),
        })),
      clearCart: () => set({ cart: [] }),
      setCart: (cart) => set({ cart }),

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
    }),
    { name: "pocket-concierge-store", version: 3 }
  )
);

export type { LedgerEntry };
