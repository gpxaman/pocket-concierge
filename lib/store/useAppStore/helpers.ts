// Cross-slice helpers that don't own any state themselves. `uid` is used by
// nearly every slice; the rest are specifically the transactions<->rides
// bridge (a ride's Transaction record is kept in sync with the ride's own
// phase, but through a mapping — not a shared status enum — since several
// ride phases collapse onto the same TransactionStatus).
import { CatalogItem, RidePhase, Transaction, TransactionStatus } from "@/lib/types";
import { findById } from "@/lib/data/catalog";
import { AppState } from "./types";

export function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function etaMinutesFor(items: { itemId: string; qty: number }[]): number | undefined {
  const catalogItems = items.map((i) => findById(i.itemId)).filter((i): i is CatalogItem => Boolean(i));
  if (catalogItems.length === 0) return undefined;
  const withEta = catalogItems.filter((i) => typeof i.etaMinutes === "number");
  if (withEta.length > 0) return Math.max(...withEta.map((i) => i.etaMinutes!));
  if (catalogItems.every((i) => i.category === "grocery")) return 120;
  return undefined;
}

// RIDE isn't here — its lifecycle is driven by the real matching/timing
// simulation in requestRide/assignDriver/.../completeRide, not this generic
// blind status walker (see slices/rideSlice.ts).
export const LIFECYCLES: Partial<Record<Transaction["type"], TransactionStatus[]>> = {
  ORDER: ["draft", "pending_authorization", "pending_vendor", "in_progress", "completed"],
  BOOKING: ["draft", "pending_authorization", "confirmed", "in_progress", "completed"],
};

export function txStatusForPhase(phase: RidePhase): TransactionStatus {
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
export function applyRidePhase(
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
