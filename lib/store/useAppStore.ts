"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  ActiveRide,
  AuditRecord,
  CartItem,
  CatalogItem,
  ChatMessage,
  MapPoint,
  MemoryItem,
  PaymentMethod,
  Preference,
  RidePhase,
  Transaction,
  TransactionStatus,
} from "@/lib/types";
import { BRAND_LABEL, detectBrand, last4Of } from "@/lib/payments";
import { cartWithItemAdded, findById } from "@/lib/data/catalog";
import { priceCart, priceStay, priceRide } from "@/lib/pricing";
import { pointsForAmount } from "@/lib/loyalty";
import { findRideType } from "@/lib/data/rideTypes";
import { Driver } from "@/lib/data/drivers";
import { SEARCH_BUDGET_MS, generateOtp, pickupEtaMinutes, tripDurationMinutes } from "@/lib/ridesim";
import type { PaymentSource } from "@/lib/types";

export type { PaymentSource } from "@/lib/types";

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
  /** Lifetime loyalty points — see lib/loyalty.ts for tiers and the earn rate. */
  points: number;
  /** The single in-flight ride, if any — see lib/ridesim.ts for the matching/timing simulation. */
  activeRide: ActiveRide | null;

  logAudit: (a: Omit<AuditRecord, "id" | "timestamp" | "correlationId"> & { correlationId?: string }) => void;
  addPoints: (amount: number) => void;

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

  /** Books a hotel room for a date range — a separate flow from the cart (dates/nights, not qty). */
  bookHotel: (
    input: { itemId: string; checkIn: string; checkOut: string; guests: number; source: PaymentSource },
    opts?: { placedBy?: "USER" | "AI_AGENT" }
  ) =>
    | { ok: true; transaction: Transaction }
    | { ok: false; reason: "invalid_dates" | "not_found" | "insufficient_balance" | "no_payment_method" };

  /**
   * Rides run as a real, timestamp-driven state machine rather than a single
   * instant "book" call — see lib/ridesim.ts for the matching/timing math.
   * Charge + points are deferred to completeRide() (not request time), so a
   * cancellation before the ride starts never needs to be reversed.
   */
  requestRide: (
    input: {
      rideTypeId: string;
      pickup: string;
      drop: string;
      pickupPoint: MapPoint;
      dropPoint: MapPoint;
      distanceKm: number;
      source: PaymentSource;
    },
    opts?: { placedBy?: "USER" | "AI_AGENT" }
  ) =>
    | { ok: true; transactionId: string }
    | { ok: false; reason: "invalid_ride_type" | "insufficient_balance" | "no_payment_method" | "ride_in_progress" };
  recordOfferRejected: (driverName: string) => void;
  assignDriver: (driver: Driver, simulatedDistanceKm: number) => void;
  markEnRoute: () => void;
  markArrived: () => void;
  recordSearchFailure: () => void;
  startTrip: () => void;
  completeRide: () => void;
  rateDriver: (stars: number) => void;
  cancelRide: () => void;
}

function etaMinutesFor(items: { itemId: string; qty: number }[]): number | undefined {
  const catalogItems = items.map((i) => findById(i.itemId)).filter((i): i is CatalogItem => Boolean(i));
  if (catalogItems.length === 0) return undefined;
  const withEta = catalogItems.filter((i) => typeof i.etaMinutes === "number");
  if (withEta.length > 0) return Math.max(...withEta.map((i) => i.etaMinutes!));
  if (catalogItems.every((i) => i.category === "grocery")) return 120;
  return undefined;
}

// RIDE isn't here — its lifecycle is driven by the real matching/timing
// simulation in requestRide/assignDriver/.../completeRide, not this generic
// blind status walker (see the ride actions below).
const LIFECYCLES: Partial<Record<Transaction["type"], TransactionStatus[]>> = {
  ORDER: ["draft", "pending_authorization", "pending_vendor", "in_progress", "completed"],
  BOOKING: ["draft", "pending_authorization", "confirmed", "in_progress", "completed"],
};

function txStatusForPhase(phase: RidePhase): TransactionStatus {
  switch (phase) {
    case "searching":
      return "pending_authorization";
    case "driver_assigned":
    case "en_route_to_pickup":
    case "driver_arrived":
      return "confirmed";
    case "in_progress":
      return "in_progress";
    case "completed":
      return "completed";
    case "cancelled":
      return "cancelled";
  }
}

/**
 * Syncs the ride's paired Transaction to a phase transition — maps the phase
 * to a TransactionStatus and only pushes a history entry when that status
 * actually changed (driver_assigned/en_route_to_pickup/driver_arrived all
 * map to "confirmed", so most of those transitions are a no-op here).
 */
function applyRidePhase(
  get: () => AppState,
  set: (partial: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => void,
  phase: RidePhase,
  extraMeta?: Record<string, string>
) {
  const ride = get().activeRide;
  if (!ride) return;
  const nextStatus = txStatusForPhase(phase);
  const now = Date.now();
  set((s) => ({
    transactions: s.transactions.map((t) => {
      if (t.id !== ride.transactionId) return t;
      const meta = extraMeta ? { ...t.meta, ...extraMeta } : t.meta;
      if (t.status === nextStatus) return { ...t, meta, updatedAt: now };
      return { ...t, status: nextStatus, meta, updatedAt: now, history: [...t.history, { status: nextStatus, at: now }] };
    }),
  }));
}

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
      points: 0,
      activeRide: null,

      addPoints: (amount) => set((s) => ({ points: s.points + amount })),

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
        if (!path) return; // RIDE has its own real state machine — see the ride actions below
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

      bookHotel: ({ itemId, checkIn, checkOut, guests, source }, opts) => {
        const item = findById(itemId);
        if (!item || item.category !== "hotels") return { ok: false as const, reason: "not_found" as const };

        // Validated here (not via the clamping nightsBetween display helper) so a
        // bad date range is rejected rather than silently treated as 1 night.
        const checkInMs = new Date(`${checkIn}T00:00:00`).getTime();
        const checkOutMs = new Date(`${checkOut}T00:00:00`).getTime();
        if (!Number.isFinite(checkInMs) || !Number.isFinite(checkOutMs) || checkOutMs <= checkInMs) {
          return { ok: false as const, reason: "invalid_dates" as const };
        }
        const nights = Math.round((checkOutMs - checkInMs) / 86_400_000);

        const { total } = priceStay(item.price, nights);
        const useWallet = source === "wallet";

        let sourceLabel: string;
        if (useWallet) {
          if (get().walletBalance < total) {
            get().logAudit({
              actorType: "USER",
              action: "purchase_blocked",
              resourceType: "booking",
              policyDecision: "blocked",
              detail: `Insufficient wallet balance for ₹${total} booking (PRD §8 policy check).`,
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
        const nightsLabel = `${nights} night${nights > 1 ? "s" : ""}`;

        const tx: Transaction = {
          id: uid("txn"),
          type: "BOOKING",
          status: "confirmed",
          itemId: item.id,
          itemTitle: `${item.title} · ${nightsLabel}`,
          providerName: item.providerName,
          amount: total,
          currency: "INR",
          createdAt: now,
          updatedAt: now,
          meta: { card: sourceLabel, checkIn, checkOut, guests: String(guests), nights: String(nights) },
          history: [
            { status: "draft", at: now },
            { status: "confirmed", at: now },
          ],
          placedBy: opts?.placedBy ?? "USER",
        };

        set((s) => ({
          transactions: [tx, ...s.transactions],
          walletBalance: useWallet ? s.walletBalance - total : s.walletBalance,
          points: s.points + pointsForAmount(total),
          ledger: [
            {
              id: uid("ledg"),
              transactionId: tx.id,
              amount: total,
              direction: "debit",
              note: `BOOKING · ${item.title} (${nightsLabel})`,
              sourceLabel,
              at: now,
            },
            ...s.ledger,
          ],
        }));

        get().logAudit({
          actorType: "USER",
          action: "booking_confirmed",
          resourceType: "booking",
          resourceId: tx.id,
          policyDecision: "allowed",
          detail: `User confirmed ₹${total} booking for ${item.title} (${checkIn} to ${checkOut}, ${guests} guest${
            guests > 1 ? "s" : ""
          }) on ${sourceLabel}.`,
        });
        if (opts?.placedBy === "AI_AGENT") {
          get().logAudit({
            actorType: "AI_AGENT",
            action: "booking_placed",
            resourceType: "booking",
            resourceId: tx.id,
            policyDecision: "allowed",
            detail: `Booked ${item.title} at ${item.providerName} — ₹${total}.`,
          });
        }

        return { ok: true as const, transaction: tx };
      },

      requestRide: ({ rideTypeId, pickup, drop, pickupPoint, dropPoint, distanceKm, source }, opts) => {
        const existing = get().activeRide;
        if (existing && existing.phase !== "completed" && existing.phase !== "cancelled") {
          return { ok: false as const, reason: "ride_in_progress" as const };
        }

        const rideType = findRideType(rideTypeId);
        if (!rideType) return { ok: false as const, reason: "invalid_ride_type" as const };

        const { total } = priceRide(rideType, distanceKm);
        const useWallet = source === "wallet";

        let sourceLabel: string;
        if (useWallet) {
          if (get().walletBalance < total) {
            get().logAudit({
              actorType: "USER",
              action: "purchase_blocked",
              resourceType: "ride",
              policyDecision: "blocked",
              detail: `Insufficient wallet balance for ₹${total} ride (PRD §8 policy check).`,
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
        const tx: Transaction = {
          id: uid("txn"),
          type: "RIDE",
          status: "pending_authorization",
          itemId: rideType.id,
          itemTitle: `${rideType.label} · ${pickup} → ${drop}`,
          providerName: rideType.label,
          amount: total,
          currency: "INR",
          createdAt: now,
          updatedAt: now,
          meta: { card: sourceLabel, pickup, drop, distanceKm: String(distanceKm) },
          history: [
            { status: "draft", at: now },
            { status: "pending_authorization", at: now },
          ],
          etaMinutes: rideType.etaMinutes,
          placedBy: opts?.placedBy ?? "USER",
        };

        const ride: ActiveRide = {
          id: uid("ride"),
          transactionId: tx.id,
          phase: "searching",
          rideTypeId: rideType.id,
          rideTypeLabel: rideType.label,
          pickup,
          drop,
          pickupPoint,
          dropPoint,
          distanceKm,
          fare: total,
          source,
          driver: null,
          driverDistanceKm: null,
          otp: null,
          requestedAt: now,
          searchDeadlineAt: now + SEARCH_BUDGET_MS,
          matchedAt: null,
          pickupEtaAt: null,
          arrivedAt: null,
          tripStartedAt: null,
          tripEtaAt: null,
          completedAt: null,
          cancelledAt: null,
          driverRatingGiven: null,
          triedDriverNames: [],
        };

        set((s) => ({ transactions: [tx, ...s.transactions], activeRide: ride }));
        get().logAudit({
          actorType: opts?.placedBy === "AI_AGENT" ? "AI_AGENT" : "USER",
          action: "ride_requested",
          resourceType: "ride",
          resourceId: tx.id,
          policyDecision: "allowed",
          detail: `Requested a ₹${total} ${rideType.label} ride (${pickup} to ${drop}) on ${sourceLabel}.`,
        });

        return { ok: true as const, transactionId: tx.id };
      },

      recordOfferRejected: (driverName) => {
        const ride = get().activeRide;
        if (!ride || ride.phase !== "searching") return;
        set((s) => ({
          activeRide: s.activeRide && { ...s.activeRide, triedDriverNames: [...s.activeRide.triedDriverNames, driverName] },
        }));
      },

      assignDriver: (driver, simulatedDistanceKm) => {
        const ride = get().activeRide;
        if (!ride || ride.phase !== "searching") return;
        set((s) => ({
          activeRide: s.activeRide && {
            ...s.activeRide,
            phase: "driver_assigned",
            matchedAt: Date.now(),
            driver,
            driverDistanceKm: simulatedDistanceKm,
          },
        }));
        applyRidePhase(get, set, "driver_assigned");
      },

      markEnRoute: () => {
        const ride = get().activeRide;
        if (!ride || ride.phase !== "driver_assigned") return;
        const now = Date.now();
        set((s) => ({
          activeRide: s.activeRide && {
            ...s.activeRide,
            phase: "en_route_to_pickup",
            pickupEtaAt: now + pickupEtaMinutes(ride.driverDistanceKm ?? 2) * 60_000,
          },
        }));
        applyRidePhase(get, set, "en_route_to_pickup");
      },

      markArrived: () => {
        const ride = get().activeRide;
        if (!ride || ride.phase !== "en_route_to_pickup") return;
        set((s) => ({
          activeRide: s.activeRide && {
            ...s.activeRide,
            phase: "driver_arrived",
            arrivedAt: Date.now(),
            otp: generateOtp(),
          },
        }));
        applyRidePhase(get, set, "driver_arrived");
      },

      recordSearchFailure: () => {
        const ride = get().activeRide;
        if (!ride || ride.phase !== "searching") return;
        applyRidePhase(get, set, "cancelled");
        get().logAudit({
          actorType: "USER",
          action: "ride_search_failed",
          resourceType: "ride",
          resourceId: ride.transactionId,
          policyDecision: "allowed",
          detail: "No nearby drivers accepted the ride within the search window.",
        });
        set({ activeRide: null });
      },

      startTrip: () => {
        const ride = get().activeRide;
        if (!ride || ride.phase !== "driver_arrived") return;
        const now = Date.now();
        set((s) => ({
          activeRide: s.activeRide && {
            ...s.activeRide,
            phase: "in_progress",
            tripStartedAt: now,
            tripEtaAt: now + tripDurationMinutes(ride.distanceKm) * 60_000,
          },
        }));
        applyRidePhase(get, set, "in_progress");
      },

      completeRide: () => {
        const ride = get().activeRide;
        if (!ride || ride.phase !== "in_progress") return;

        const useWallet = ride.source === "wallet";
        let paid = true;
        let sourceLabel = "Wallet balance";
        if (useWallet) {
          paid = get().walletBalance >= ride.fare;
        } else {
          const method = get().paymentMethods.find((m) => m.id === ride.source);
          paid = Boolean(method);
          if (method) sourceLabel = `${BRAND_LABEL[method.brand]} •••• ${method.last4}`;
        }

        const now = Date.now();
        set((s) => ({
          activeRide: s.activeRide && { ...s.activeRide, phase: "completed", completedAt: now },
          walletBalance: paid && useWallet ? s.walletBalance - ride.fare : s.walletBalance,
          points: paid ? s.points + pointsForAmount(ride.fare) : s.points,
          ledger: paid
            ? [
                {
                  id: uid("ledg"),
                  transactionId: ride.transactionId,
                  amount: ride.fare,
                  direction: "debit" as const,
                  note: `RIDE · ${ride.rideTypeLabel} (${ride.pickup} → ${ride.drop})`,
                  sourceLabel,
                  at: now,
                },
                ...s.ledger,
              ]
            : s.ledger,
        }));
        applyRidePhase(get, set, "completed", paid ? undefined : { paymentIssue: "true" });

        get().logAudit({
          actorType: "USER",
          action: paid ? "ride_completed" : "ride_payment_failed",
          resourceType: "ride",
          resourceId: ride.transactionId,
          policyDecision: "allowed",
          detail: paid
            ? `Ride completed — charged ₹${ride.fare} on ${sourceLabel}.`
            : `Ride completed but the payment source was no longer valid — ₹${ride.fare} not captured.`,
        });
      },

      rateDriver: (stars) => {
        const ride = get().activeRide;
        if (!ride || ride.phase !== "completed") return;
        set((s) => ({
          transactions: s.transactions.map((t) =>
            t.id === ride.transactionId ? { ...t, meta: { ...t.meta, driverRatingGiven: String(stars) } } : t
          ),
          activeRide: null,
        }));
        get().logAudit({
          actorType: "USER",
          action: "ride_rated",
          resourceType: "ride",
          resourceId: ride.transactionId,
          policyDecision: "allowed",
          detail: `Rider gave ${stars}★ for the ride with ${ride.driver?.name ?? "the driver"}.`,
        });
      },

      cancelRide: () => {
        const ride = get().activeRide;
        if (!ride || ride.phase === "in_progress" || ride.phase === "completed" || ride.phase === "cancelled") return;
        applyRidePhase(get, set, "cancelled");
        set({ activeRide: null });
        get().logAudit({
          actorType: "USER",
          action: "ride_cancelled",
          resourceType: "ride",
          resourceId: ride.transactionId,
          policyDecision: "allowed",
          detail: "Rider cancelled before the trip started — nothing was charged.",
        });
      },
    }),
    { name: "pocket-concierge-store", version: 3 }
  )
);

export type { LedgerEntry };
