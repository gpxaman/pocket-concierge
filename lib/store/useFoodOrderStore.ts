"use client";

import { create } from "zustand";
import { ActiveFoodOrder, FoodOrderPhase } from "@/lib/types";
import { randomDeliveryPartner } from "@/lib/food";
import { useAppStore } from "@/lib/store/useAppStore";

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

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

interface FoodOrderState {
  activeOrder: ActiveFoodOrder | null;
  placeOrder: (input: { itemTitle: string; restaurantName: string; address: string; fare: number; transactionId: string }) => void;
  cancelOrder: () => void;
  ratePartner: (stars: number) => void;
  clearOrder: () => void;
}

export const useFoodOrderStore = create<FoodOrderState>()((set, get) => ({
  activeOrder: null,

  placeOrder: ({ itemTitle, restaurantName, address, fare, transactionId }) => {
    clearTimers();
    const order: ActiveFoodOrder = {
      id: uid("order"),
      transactionId,
      phase: "placed",
      itemTitle,
      restaurantName,
      address,
      fare,
      partner: null,
      etaMinutes: null,
      placedAt: Date.now(),
      pickedUpAt: null,
      deliveredAt: null,
      partnerRating: null,
    };
    set({ activeOrder: order });

    schedule(() => {
      set((s) => (s.activeOrder ? { activeOrder: { ...s.activeOrder, phase: "preparing" } } : {}));

      schedule(() => {
        const etaMinutes = 15 + Math.floor(Math.random() * 15);
        set((s) => (s.activeOrder ? { activeOrder: { ...s.activeOrder, phase: "assigned", partner: randomDeliveryPartner(), etaMinutes } } : {}));

        schedule(() => {
          set((s) => (s.activeOrder ? { activeOrder: { ...s.activeOrder, phase: "picked_up", pickedUpAt: Date.now() } } : {}));
          useAppStore.getState().advanceTransaction(transactionId); // pending_vendor -> in_progress

          schedule(() => {
            set((s) => (s.activeOrder ? { activeOrder: { ...s.activeOrder, phase: "delivered", deliveredAt: Date.now() } } : {}));
            useAppStore.getState().advanceTransaction(transactionId); // in_progress -> completed
          }, 5000);
        }, 4000);
      }, 2600);
    }, 1800);
  },

  cancelOrder: () => {
    clearTimers();
    const order = get().activeOrder;
    if (order) useAppStore.getState().cancelTransaction(order.transactionId);
    set((s) => (s.activeOrder ? { activeOrder: { ...s.activeOrder, phase: "cancelled" as FoodOrderPhase } } : {}));
  },

  ratePartner: (stars) => set((s) => (s.activeOrder ? { activeOrder: { ...s.activeOrder, partnerRating: stars } } : {})),

  clearOrder: () => {
    clearTimers();
    set({ activeOrder: null });
  },
}));
