// The one order/booking/ride ledger record type, shared by every checkout
// path (single-item Explore drafts and multi-item AI-agent cart checkout
// alike) so Activity/Payments only ever need to render one shape.

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

/** "wallet" pays from the topped-up balance; any other string is a PaymentMethod id. */
export type PaymentSource = "wallet" | string;
