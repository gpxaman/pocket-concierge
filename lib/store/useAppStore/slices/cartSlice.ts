import { StateCreator } from "zustand";
import { cartWithItemAdded } from "@/lib/data/catalog";
import { AppState, CartSlice } from "../types";

export const createCartSlice: StateCreator<AppState, [], [], CartSlice> = (set, get) => ({
  cart: [],

  addToCart: (itemId, qty = 1) => {
    const { cart, restaurantSwitched } = cartWithItemAdded(get().cart, itemId, qty);
    set({ cart });
    return { restaurantSwitched };
  },
  removeFromCart: (itemId) => set((s) => ({ cart: s.cart.filter((c) => c.itemId !== itemId) })),
  setCartQty: (itemId, qty) =>
    set((s) => ({
      cart: qty <= 0 ? s.cart.filter((c) => c.itemId !== itemId) : s.cart.map((c) => (c.itemId === itemId ? { ...c, qty } : c)),
    })),
  clearCart: () => set({ cart: [] }),
  setCart: (cart) => set({ cart }),
});
