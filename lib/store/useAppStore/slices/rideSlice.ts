import { StateCreator } from "zustand";
import { ActiveRide, Transaction } from "@/lib/types";
import { findRideType } from "@/lib/data/rideTypes";
import { priceRide } from "@/lib/pricing";
import { pointsForAmount } from "@/lib/loyalty";
import { BRAND_LABEL } from "@/lib/payments";
import { SEARCH_BUDGET_MS, generateOtp, pickupEtaMinutes, tripDurationMinutes } from "@/lib/ridesim";
import { AppState, RideSlice } from "../types";
import { uid, applyRidePhase } from "../helpers";

export const createRideSlice: StateCreator<AppState, [], [], RideSlice> = (set, get) => ({
  activeRide: null,

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
});
