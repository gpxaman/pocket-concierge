import { StateCreator } from "zustand";
import { Transaction } from "@/lib/types";
import { findById } from "@/lib/data/catalog";
import { priceStay } from "@/lib/pricing";
import { pointsForAmount } from "@/lib/loyalty";
import { BRAND_LABEL } from "@/lib/payments";
import { AppState, HotelBookingSlice } from "../types";
import { uid } from "../helpers";

export const createHotelBookingSlice: StateCreator<AppState, [], [], HotelBookingSlice> = (set, get) => ({
  bookHotel: ({ itemId, checkIn, checkOut, guests, source }, opts) => {
    const item = findById(itemId);
    if (!item || item.category !== "hotels") return { ok: false as const, reason: "not_found" as const };

    // Validated here (not via the clamping nightsBetween display helper) so a
    // bad date range is rejected rather than silently treated as 1 night.
    const checkInMs = new Date(`${checkIn}T00:00:00`).getTime();
    const checkOutMs = new Date(`${checkOut}T00:00:00`).getTime();
    if (!Number.isFinite(checkInMs) || !Number.isFinite(checkOutMs) || checkOutMs <= checkInMs) {
      return { ok: false as const, reason: "invalid_dates" as const };
    }
    const nights = Math.round((checkOutMs - checkInMs) / 86_400_000);

    const { total } = priceStay(item.price, nights);
    const useWallet = source === "wallet";

    let sourceLabel: string;
    if (useWallet) {
      if (get().walletBalance < total) {
        get().logAudit({
          actorType: "USER",
          action: "purchase_blocked",
          resourceType: "booking",
          policyDecision: "blocked",
          detail: `Insufficient wallet balance for ₹${total} booking (PRD §8 policy check).`,
        });
        return { ok: false as const, reason: "insufficient_balance" as const };
      }
      sourceLabel = "Wallet balance";
    } else {
      const methods = get().paymentMethods;
      const method = methods.find((m) => m.id === source) ?? methods.find((m) => m.isDefault) ?? methods[0];
      if (!method) return { ok: false as const, reason: "no_payment_method" as const };
      sourceLabel = `${BRAND_LABEL[method.brand]} •••• ${method.last4}`;
    }

    const now = Date.now();
    const nightsLabel = `${nights} night${nights > 1 ? "s" : ""}`;

    const tx: Transaction = {
      id: uid("txn"),
      type: "BOOKING",
      status: "confirmed",
      itemId: item.id,
      itemTitle: `${item.title} · ${nightsLabel}`,
      providerName: item.providerName,
      amount: total,
      currency: "INR",
      createdAt: now,
      updatedAt: now,
      meta: { card: sourceLabel, checkIn, checkOut, guests: String(guests), nights: String(nights) },
      history: [
        { status: "draft", at: now },
        { status: "confirmed", at: now },
      ],
      placedBy: opts?.placedBy ?? "USER",
    };

    set((s) => ({
      transactions: [tx, ...s.transactions],
      walletBalance: useWallet ? s.walletBalance - total : s.walletBalance,
      points: s.points + pointsForAmount(total),
      ledger: [
        {
          id: uid("ledg"),
          transactionId: tx.id,
          amount: total,
          direction: "debit",
          note: `BOOKING · ${item.title} (${nightsLabel})`,
          sourceLabel,
          at: now,
        },
        ...s.ledger,
      ],
    }));

    get().logAudit({
      actorType: "USER",
      action: "booking_confirmed",
      resourceType: "booking",
      resourceId: tx.id,
      policyDecision: "allowed",
      detail: `User confirmed ₹${total} booking for ${item.title} (${checkIn} to ${checkOut}, ${guests} guest${
        guests > 1 ? "s" : ""
      }) on ${sourceLabel}.`,
    });
    if (opts?.placedBy === "AI_AGENT") {
      get().logAudit({
        actorType: "AI_AGENT",
        action: "booking_placed",
        resourceType: "booking",
        resourceId: tx.id,
        policyDecision: "allowed",
        detail: `Booked ${item.title} at ${item.providerName} — ₹${total}.`,
      });
    }

    return { ok: true as const, transaction: tx };
  },
});
