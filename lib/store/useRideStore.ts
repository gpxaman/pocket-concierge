"use client";

import { create } from "zustand";
import { ActiveRide, RidePhase } from "@/lib/types";
import { randomDriver } from "@/lib/rides";
import { useAppStore } from "@/lib/store/useAppStore";

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

// 1 simulated ETA-minute = 1.4s of real time — long enough to feel like a
// real wait with a moving countdown, short enough that a demo ride doesn't
// take actual minutes.
const SIM_MS_PER_MINUTE = 1400;

let timers: ReturnType<typeof setTimeout>[] = [];
function schedule(fn: () => void, ms: number) {
  const t = setTimeout(fn, ms);
  timers.push(t);
  return t;
}
function clearTimers() {
  timers.forEach(clearTimeout);
  timers = [];
}

interface RideState {
  activeRide: ActiveRide | null;
  requestRide: (input: {
    tierId: string;
    tierName: string;
    pickup: string;
    destination: string;
    distanceKm: number;
    fare: number;
    transactionId: string;
  }) => void;
  cancelRide: () => void;
  rateDriver: (stars: number) => void;
  clearRide: () => void;
}

export const useRideStore = create<RideState>()((set, get) => ({
  activeRide: null,

  requestRide: ({ tierId, tierName, pickup, destination, distanceKm, fare, transactionId }) => {
    clearTimers();
    const ride: ActiveRide = {
      id: uid("ride"),
      transactionId,
      phase: "searching",
      tierName,
      pickup,
      destination,
      distanceKm,
      fare,
      driver: null,
      etaMinutes: null,
      requestedAt: Date.now(),
      arrivedAt: null,
      startedAt: null,
      completedAt: null,
      driverRating: null,
    };
    set({ activeRide: ride });

    schedule(() => {
      const etaMinutes = 2 + Math.floor(Math.random() * 5);
      set((s) => (s.activeRide ? { activeRide: { ...s.activeRide, phase: "assigned", driver: randomDriver(tierId), etaMinutes } } : {}));

      schedule(() => {
        set((s) => (s.activeRide ? { activeRide: { ...s.activeRide, phase: "arrived", arrivedAt: Date.now() } } : {}));

        schedule(() => {
          const current = get().activeRide;
          if (!current) return;
          set((s) => (s.activeRide ? { activeRide: { ...s.activeRide, phase: "in_progress", startedAt: Date.now() } } : {}));
          useAppStore.getState().advanceTransaction(transactionId); // confirmed -> in_progress

          const tripMs = Math.min(12000, Math.max(3000, distanceKm * 700));
          schedule(() => {
            set((s) => (s.activeRide ? { activeRide: { ...s.activeRide, phase: "completed", completedAt: Date.now() } } : {}));
            useAppStore.getState().advanceTransaction(transactionId); // in_progress -> completed
          }, tripMs);
        }, 1800);
      }, etaMinutes * SIM_MS_PER_MINUTE);
    }, 2200);
  },

  cancelRide: () => {
    clearTimers();
    const ride = get().activeRide;
    if (ride) useAppStore.getState().cancelTransaction(ride.transactionId);
    set((s) => (s.activeRide ? { activeRide: { ...s.activeRide, phase: "cancelled" as RidePhase } } : {}));
  },

  rateDriver: (stars) => set((s) => (s.activeRide ? { activeRide: { ...s.activeRide, driverRating: stars } } : {})),

  clearRide: () => {
    clearTimers();
    set({ activeRide: null });
  },
}));
