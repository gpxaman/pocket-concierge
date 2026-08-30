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
  /** First-class veg/non-veg flag (food items) — mirrors the Zomato/DoorDash veg dot. */
  veg?: boolean;
  /** Strike-through original price, shown alongside `price` when discounted (grocery, Blinkit-style). */
  mrp?: number;
  /** Menu section a food item belongs to, e.g. "Starters", "Mains" (Zomato/DoorDash-style categorized menu). */
  menuSection?: string;
  /** Highlighted as a bestseller on the restaurant menu. */
  isBestseller?: boolean;
  /** Pack size, e.g. "500 g", "1 L" (grocery only). */
  weight?: string;
  /** Which grocery shelf/category this product belongs to (Blinkit-style subcategory). */
  groceryCategoryId?: string;
}

export interface Restaurant {
  id: string; // matches the providerId used by this restaurant's food CatalogItems
  name: string;
  cuisines: string[];
  rating: number;
  ratingCount: number;
  deliveryEtaMinutes: number;
  priceForTwo: number;
  area: string;
  isPureVeg: boolean;
  offer?: string;
  /** Placeholder banner gradient — no real photos in this prototype. */
  gradientFrom: string;
  gradientTo: string;
}

export interface GroceryCategoryMeta {
  id: string;
  label: string;
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

export interface TransactionLineItem {
  itemId: string;
  title: string;
  providerName: string;
  qty: number;
  price: number;
}

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
  /** Multi-item orders (e.g. AI-agent checkout of a cart). Absent for single-item drafts. */
  items?: TransactionLineItem[];
  /** Estimated arrival, set at checkout for orders/rides with a known ETA. */
  etaMinutes?: number;
  placedBy?: "USER" | "AI_AGENT";
}

export interface CartItem {
  itemId: string;
  qty: number;
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
  mode?: "claude" | "gemini" | "openrouter" | "fallback";
  createdAt: number;
}
