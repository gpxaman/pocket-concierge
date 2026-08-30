// Simplified client-side mirrors of the PRD/TRD data model (section 16).
// In a real build these live behind domain services; here they're just
// typed shapes shared by the mock catalog, the tool layer and the UI.

export type ServiceCategory =
  | "electronics"
  | "food"
  | "grocery"
  | "fashion"
  | "hotels"
  | "rides"
  | "services";

export interface CatalogItem {
  id: string;
  category: ServiceCategory;
  providerId: string;
  providerName: string;
  title: string;
  subtitle?: string;
  price: number;
  currency: "INR";
  attributes: Record<string, string | number | boolean>;
  rating?: number;
  etaMinutes?: number;
  location?: string;
}

export type TransactionType = "ORDER" | "BOOKING" | "RIDE";

export type TransactionStatus =
  | "draft"
  | "pending_authorization"
  | "pending_vendor"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface Transaction {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  itemId: string;
  itemTitle: string;
  providerName: string;
  amount: number;
  currency: "INR";
  createdAt: number;
  updatedAt: number;
  meta?: Record<string, string>;
  history: { status: TransactionStatus; at: number; note?: string }[];
}

export interface Preference {
  key: string;
  value: string;
  updatedAt: number;
}

export interface MemoryItem {
  id: string;
  fact: string;
  confidence: number; // 0-1
  provenance: "explicit" | "inferred";
  createdAt: number;
}

export type CardBrand = "visa" | "mastercard" | "amex" | "rupay" | "card";

export interface PaymentMethod {
  id: string;
  brand: CardBrand;
  last4: string;
  expiry: string; // MM/YY
  holderName: string;
  isDefault: boolean;
  createdAt: number;
}

export interface AuditRecord {
  id: string;
  actorType: "USER" | "AI_AGENT";
  action: string;
  resourceType: string;
  resourceId?: string;
  policyDecision: "allowed" | "requires_confirmation" | "blocked";
  detail?: string;
  correlationId: string;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  itemIds?: string[];
  mode?: "claude" | "gemini" | "fallback";
  createdAt: number;
}

// --- Snap (camera + filters) + creator registration ---

export interface FilterSettings {
  brightness: number; // 100 = unchanged
  contrast: number;
  saturation: number;
  hueRotate: number; // degrees, -180..180
  sepia: number; // 0-100
  grayscale: number; // 0-100
}

export interface CreatorFilter extends FilterSettings {
  id: string;
  name: string;
  createdAt: number;
}

export interface CreatorProfile {
  handle: string;
  category: string;
  bio: string;
  registeredAt: number;
}

export interface Snap {
  id: string;
  dataUrl: string;
  filterName: string;
  createdAt: number;
}

// --- Rides (cab booking) + food delivery: shared live-tracking domain ---

export type RidePhase = "searching" | "assigned" | "arrived" | "in_progress" | "completed" | "cancelled";

export interface RideDriver {
  name: string;
  vehicle: string;
  plate: string;
  rating: number;
}

export interface ActiveRide {
  id: string;
  transactionId: string;
  phase: RidePhase;
  tierName: string;
  pickup: string;
  destination: string;
  distanceKm: number;
  fare: number;
  driver: RideDriver | null;
  etaMinutes: number | null;
  requestedAt: number;
  arrivedAt: number | null;
  startedAt: number | null;
  completedAt: number | null;
  driverRating: number | null;
}

export type FoodOrderPhase = "placed" | "preparing" | "assigned" | "picked_up" | "delivered" | "cancelled";

export interface DeliveryPartner {
  name: string;
  vehicle: string;
  rating: number;
}

export interface ActiveFoodOrder {
  id: string;
  transactionId: string;
  phase: FoodOrderPhase;
  itemTitle: string;
  restaurantName: string;
  address: string;
  fare: number;
  partner: DeliveryPartner | null;
  etaMinutes: number | null;
  placedAt: number;
  pickedUpAt: number | null;
  deliveredAt: number | null;
  partnerRating: number | null;
}
