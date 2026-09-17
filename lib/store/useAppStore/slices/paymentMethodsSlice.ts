import { StateCreator } from "zustand";
import { PaymentMethod } from "@/lib/types";
import { BRAND_LABEL, detectBrand, last4Of } from "@/lib/payments";
import { AppState, PaymentMethodsSlice } from "../types";
import { uid } from "../helpers";

export const createPaymentMethodsSlice: StateCreator<AppState, [], [], PaymentMethodsSlice> = (set, get) => ({
  paymentMethods: [],

  addPaymentMethod: ({ cardNumber, holderName, expiry }) => {
    const method: PaymentMethod = {
      id: uid("pm"),
      brand: detectBrand(cardNumber),
      last4: last4Of(cardNumber),
      expiry,
      holderName,
      isDefault: get().paymentMethods.length === 0,
      createdAt: Date.now(),
    };
    set((s) => ({ paymentMethods: [...s.paymentMethods, method] }));
    get().logAudit({
      actorType: "USER",
      action: "payment_method_added",
      resourceType: "payment_method",
      resourceId: method.id,
      policyDecision: "allowed",
      detail: `${BRAND_LABEL[method.brand]} •••• ${method.last4} added. Card number was never stored (TRD §6.2).`,
    });
  },

  removePaymentMethod: (id) => {
    set((s) => {
      const removed = s.paymentMethods.find((m) => m.id === id);
      const remaining = s.paymentMethods.filter((m) => m.id !== id);
      if (removed?.isDefault && remaining.length > 0) remaining[0] = { ...remaining[0], isDefault: true };
      return { paymentMethods: remaining };
    });
    get().logAudit({
      actorType: "USER",
      action: "payment_method_removed",
      resourceType: "payment_method",
      resourceId: id,
      policyDecision: "allowed",
    });
  },

  setDefaultPaymentMethod: (id) =>
    set((s) => ({
      paymentMethods: s.paymentMethods.map((m) => ({ ...m, isDefault: m.id === id })),
    })),
});
