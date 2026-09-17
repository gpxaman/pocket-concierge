import { beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "@/lib/store/useAppStore";
import { priceCart } from "@/lib/pricing";

// addToCart lives in CartSlice, placeOrderFromCart in OrdersSlice, and the
// wallet debit/points award happen in the same `set` call — this is the
// seam that would silently break if the slice split ever stopped sharing
// one `set`/`get` per store.
describe("cart -> checkout integration", () => {
  beforeEach(() => {
    useAppStore.setState({ cart: [], transactions: [], ledger: [], walletBalance: 0, points: 0 });
  });

  it("places an order from the cart, debiting the wallet the full priced total and awarding points", () => {
    useAppStore.getState().addBalance(2000);
    useAppStore.getState().addToCart("food-001", 2);

    const cartBeforeCheckout = useAppStore.getState().cart;
    const expectedTotal = priceCart(cartBeforeCheckout).total;

    const result = useAppStore.getState().placeOrderFromCart("wallet", { placedBy: "USER" });
    expect(result.ok).toBe(true);

    expect(useAppStore.getState().cart).toEqual([]); // cart cleared after checkout
    expect(useAppStore.getState().walletBalance).toBe(2000 - expectedTotal);
    expect(useAppStore.getState().points).toBeGreaterThan(0);

    const tx = useAppStore.getState().transactions[0];
    expect(tx.status).toBe("pending_vendor");
    expect(tx.amount).toBe(expectedTotal);
  });

  it("refuses to place an order from an empty cart", () => {
    const result = useAppStore.getState().placeOrderFromCart("wallet", { placedBy: "USER" });
    expect(result).toEqual({ ok: false, reason: "empty_cart" });
  });

  it("refuses checkout when the wallet balance can't cover the priced total, leaving the cart intact", () => {
    useAppStore.getState().addToCart("food-001", 1); // ₹249 + fees
    useAppStore.getState().addBalance(10); // nowhere near enough

    const result = useAppStore.getState().placeOrderFromCart("wallet", { placedBy: "USER" });
    expect(result).toEqual({ ok: false, reason: "insufficient_balance" });
    expect(useAppStore.getState().cart.length).toBe(1); // untouched
    expect(useAppStore.getState().transactions.length).toBe(0);
  });

  it("switches restaurants correctly through the real store, not just the pure helper", () => {
    useAppStore.getState().addToCart("food-001", 1); // rest-spicehouse
    const { restaurantSwitched } = useAppStore.getState().addToCart("food-002", 1); // rest-tokyobites
    expect(restaurantSwitched).toBe(true);
    expect(useAppStore.getState().cart).toEqual([{ itemId: "food-002", qty: 1 }]);
  });
});
