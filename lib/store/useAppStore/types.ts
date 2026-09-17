// All slice interfaces + the combined AppState live in one file (not
// alongside each slice) specifically to avoid a circular import: every
// slice needs `AppState` (zustand's slices pattern types each slice as
// `StateCreator<AppState, [], [], ThisSlice>` so cross-slice `get()` calls
// stay fully typed), and `AppState` is the intersection of every slice.
// Putting them in the same type-only file breaks that cycle.
import {
  ActiveRide,
  AuditRecord,
  CartItem,
  CatalogItem,
  ChatMessage,
  MapPoint,
  MemoryItem,
  PaymentMethod,
  PaymentSource,
  Preference,
  Transaction,
} from "@/lib/types";

export interface LedgerEntry {
  id: string;
  transactionId: string;
  amount: number;
  direction: "debit" | "credit";
  note: string;
  sourceLabel: string;
  at: number;
}

export interface AuditSlice {
  audit: AuditRecord[];
  logAudit: (a: Omit<AuditRecord, "id" | "timestamp" | "correlationId"> & { correlationId?: string }) => void;
}

export interface LoyaltySlice {
  /** Lifetime loyalty points — see lib/loyalty.ts for tiers and the earn rate. */
  points: number;
  addPoints: (amount: number) => void;
}

export interface WalletSlice {
  walletBalance: number;
  ledger: LedgerEntry[];
  addBalance: (amount: number, viaCardId?: string) => void;
}

export interface PaymentMethodsSlice {
  paymentMethods: PaymentMethod[];
  addPaymentMethod: (input: { cardNumber: string; holderName: string; expiry: string }) => void;
  removePaymentMethod: (id: string) => void;
  setDefaultPaymentMethod: (id: string) => void;
}

export interface TransactionsSlice {
  transactions: Transaction[];
  createDraft: (item: CatalogItem, type: Transaction["type"]) => Transaction;
  authorizeTransaction: (
    id: string,
    source?: PaymentSource
  ) => { ok: true } | { ok: false; reason: "not_draft" | "no_payment_method" | "insufficient_balance" };
  cancelTransaction: (id: string) => void;
  advanceTransaction: (id: string) => void;
}

export interface CartSlice {
  cart: CartItem[];
  /** Returns whether adding this item reset the cart to switch restaurants (single-restaurant-food-cart rule). */
  addToCart: (itemId: string, qty?: number) => { restaurantSwitched: boolean };
  removeFromCart: (itemId: string) => void;
  setCartQty: (itemId: string, qty: number) => void;
  clearCart: () => void;
  setCart: (cart: CartItem[]) => void;
}

export interface OrdersSlice {
  placeOrderFromCart: (
    source: PaymentSource,
    opts?: { placedBy?: "USER" | "AI_AGENT" }
  ) =>
    | { ok: true; transaction: Transaction }
    | { ok: false; reason: "empty_cart" | "insufficient_balance" | "no_payment_method" };
}

export interface HotelBookingSlice {
  /** Books a hotel room for a date range — a separate flow from the cart (dates/nights, not qty). */
  bookHotel: (
    input: { itemId: string; checkIn: string; checkOut: string; guests: number; source: PaymentSource },
    opts?: { placedBy?: "USER" | "AI_AGENT" }
  ) =>
    | { ok: true; transaction: Transaction }
    | { ok: false; reason: "invalid_dates" | "not_found" | "insufficient_balance" | "no_payment_method" };
}

export interface RideSlice {
  /** The single in-flight ride, if any — see lib/ridesim.ts for the matching/timing simulation. */
  activeRide: ActiveRide | null;

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
  assignDriver: (driver: import("@/lib/data/drivers").Driver, simulatedDistanceKm: number) => void;
  markEnRoute: () => void;
  markArrived: () => void;
  recordSearchFailure: () => void;
  startTrip: () => void;
  completeRide: () => void;
  rateDriver: (stars: number) => void;
  cancelRide: () => void;
}

export interface MemorySlice {
  memory: MemoryItem[];
  personalizationEnabled: boolean;
  addMemory: (fact: string, provenance: MemoryItem["provenance"], confidence?: number) => void;
  deleteMemory: (id: string) => void;
  clearMemory: () => void;
  setPersonalizationEnabled: (v: boolean) => void;
}

export interface PreferencesSlice {
  preferences: Preference[];
  setPreference: (key: string, value: string) => void;
  deletePreference: (key: string) => void;
}

export interface UiSlice {
  chatMessages: ChatMessage[];
  displayName: string;
  addChatMessage: (m: ChatMessage) => void;
  clearChat: () => void;
  setDisplayName: (name: string) => void;
}

export type AppState = AuditSlice &
  LoyaltySlice &
  WalletSlice &
  PaymentMethodsSlice &
  TransactionsSlice &
  CartSlice &
  OrdersSlice &
  HotelBookingSlice &
  RideSlice &
  MemorySlice &
  PreferencesSlice &
  UiSlice;
