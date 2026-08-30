"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useAppStore } from "@/lib/store/useAppStore";
import { findById } from "@/lib/data/catalog";

// Zomato/DoorDash pattern: a floating bar anchored above the bottom nav,
// visible from anywhere while the cart has items, linking to checkout.
export default function CartFloatingBar() {
  const cart = useAppStore((s) => s.cart);

  if (cart.length === 0) return null;

  const count = cart.reduce((n, c) => n + c.qty, 0);
  const total = cart.reduce((sum, c) => sum + (findById(c.itemId)?.price ?? 0) * c.qty, 0);

  return (
    <div className="fixed inset-x-0 bottom-20 z-30 mx-auto max-w-md px-4">
      <Link
        href="/cart"
        className="flex items-center justify-between rounded-xl2 bg-ink px-4 py-3 text-white shadow-lg transition hover:brightness-110"
      >
        <span className="inline-flex items-center gap-2 text-sm font-medium">
          <ShoppingBag size={16} className="text-accent" />
          {count} item{count > 1 ? "s" : ""} · ₹{total.toLocaleString("en-IN")}
        </span>
        <span className="text-sm font-semibold text-accent">View Cart →</span>
      </Link>
    </div>
  );
}
