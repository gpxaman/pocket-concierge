// Saved-card shape. Deliberately never carries a full card number (see
// lib/payments.ts detectBrand/last4Of) — TRD §6.2 "never store raw payment
// credentials".

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
