"use client";

import { Minus, Plus } from "lucide-react";
import { useAppStore } from "@/lib/store/useAppStore";
import clsx from "clsx";

// Blinkit/DoorDash pattern: an "ADD" button that turns into a −/qty/+
// stepper once the item is in the cart.
export default function QtyStepper({
  itemId,
  onRestaurantSwitch,
}: {
  itemId: string;
  /** Called when adding this item cleared a different restaurant's items out of the cart. */
  onRestaurantSwitch?: () => void;
}) {
  const qty = useAppStore((s) => s.cart.find((c) => c.itemId === itemId)?.qty ?? 0);
  const addToCart = useAppStore((s) => s.addToCart);
  const setCartQty = useAppStore((s) => s.setCartQty);

  function add() {
    const { restaurantSwitched } = addToCart(itemId, 1);
    if (restaurantSwitched) onRestaurantSwitch?.();
  }

  if (qty === 0) {
    return (
      <button
        onClick={add}
        className="rounded-lg border border-accentDark/40 bg-white px-4 py-1.5 text-xs font-bold tracking-wide text-accentDark shadow-sm transition hover:bg-accentSoft"
      >
        ADD
      </button>
    );
  }

  return (
    <div className={clsx("inline-flex items-center gap-2.5 rounded-lg bg-accent px-1.5 py-1 text-ink shadow-sm")}>
      <button
        onClick={() => setCartQty(itemId, qty - 1)}
        className="flex h-5 w-5 items-center justify-center rounded-md hover:bg-black/10"
        aria-label="Decrease quantity"
      >
        <Minus size={13} strokeWidth={2.5} />
      </button>
      <span className="min-w-[1ch] text-center text-xs font-bold">{qty}</span>
      <button onClick={add} className="flex h-5 w-5 items-center justify-center rounded-md hover:bg-black/10" aria-label="Increase quantity">
        <Plus size={13} strokeWidth={2.5} />
      </button>
    </div>
  );
}
