// Points are mostly awarded directly by ordersSlice/hotelBookingSlice/
// rideSlice inline (via pointsForAmount) rather than through `addPoints` —
// this action exists for the rare case something needs to award points
// without going through a checkout flow.
import { StateCreator } from "zustand";
import { AppState, LoyaltySlice } from "../types";

export const createLoyaltySlice: StateCreator<AppState, [], [], LoyaltySlice> = (set) => ({
  points: 0,
  addPoints: (amount) => set((s) => ({ points: s.points + amount })),
});
