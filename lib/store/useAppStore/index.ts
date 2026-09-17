"use client";

// Combines every domain slice into one store via zustand's documented
// "slices" pattern: each slice is a `(set, get, api) => ({...})` function
// typed against the *whole* combined AppState, so cross-slice reads (e.g.
// authorizeTransaction reading walletBalance) are just `get()` — nothing
// about runtime behavior changes versus one big object literal, only the
// file layout does. See ./types.ts for why the slice interfaces live
// together instead of next to each slice (avoids a circular type import).
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AppState } from "./types";
import { createAuditSlice } from "./slices/auditSlice";
import { createLoyaltySlice } from "./slices/loyaltySlice";
import { createWalletSlice } from "./slices/walletSlice";
import { createPaymentMethodsSlice } from "./slices/paymentMethodsSlice";
import { createTransactionsSlice } from "./slices/transactionsSlice";
import { createCartSlice } from "./slices/cartSlice";
import { createOrdersSlice } from "./slices/ordersSlice";
import { createHotelBookingSlice } from "./slices/hotelBookingSlice";
import { createRideSlice } from "./slices/rideSlice";
import { createMemorySlice } from "./slices/memorySlice";
import { createPreferencesSlice } from "./slices/preferencesSlice";
import { createUiSlice } from "./slices/uiSlice";

export const useAppStore = create<AppState>()(
  persist(
    (...a) => ({
      ...createAuditSlice(...a),
      ...createLoyaltySlice(...a),
      ...createWalletSlice(...a),
      ...createPaymentMethodsSlice(...a),
      ...createTransactionsSlice(...a),
      ...createCartSlice(...a),
      ...createOrdersSlice(...a),
      ...createHotelBookingSlice(...a),
      ...createRideSlice(...a),
      ...createMemorySlice(...a),
      ...createPreferencesSlice(...a),
      ...createUiSlice(...a),
    }),
    // Unchanged from before the slice split: no partialize, so every field
    // above persists to localStorage as-is. Bump `version` (with a
    // `migrate`) if a future change needs to reshape saved state.
    { name: "pocket-concierge-store", version: 3 }
  )
);

// Re-exported so existing `import { PaymentSource } from "@/lib/store/useAppStore"`
// call sites don't need to change to `@/lib/types`.
export type { PaymentSource } from "@/lib/types";
export type { LedgerEntry } from "./types";
