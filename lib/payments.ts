import { CardBrand } from "@/lib/types";

// Demo-only helpers. TRD §6.2: never store raw payment credentials — this
// derives brand/last4 for display and discards the rest of the number.
export function detectBrand(cardNumber: string): CardBrand {
  const digits = cardNumber.replace(/\D/g, "");
  if (/^4/.test(digits)) return "visa";
  if (/^5[1-5]/.test(digits) || /^2[2-7]/.test(digits)) return "mastercard";
  if (/^3[47]/.test(digits)) return "amex";
  if (/^6/.test(digits)) return "rupay";
  return "card";
}

export const BRAND_LABEL: Record<CardBrand, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "Amex",
  rupay: "RuPay",
  card: "Card",
};

export function last4Of(cardNumber: string): string {
  const digits = cardNumber.replace(/\D/g, "");
  return digits.slice(-4).padStart(4, "0");
}

export function isValidCardNumber(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, "");
  return digits.length >= 12 && digits.length <= 19;
}

export function isValidExpiry(expiry: string): boolean {
  const match = expiry.match(/^(\d{2})\s*\/\s*(\d{2})$/);
  if (!match) return false;
  const month = Number(match[1]);
  if (month < 1 || month > 12) return false;
  const year = 2000 + Number(match[2]);
  const now = new Date();
  const expDate = new Date(year, month, 0, 23, 59, 59);
  return expDate.getTime() >= now.getTime();
}
