import { ShoppingBasket } from "lucide-react";
import { CatalogItem } from "@/lib/types";
import { GROCERY_CATEGORY_ICON } from "@/lib/data/groceryCategories";
import QtyStepper from "@/components/QtyStepper";

export default function ProductCard({ item }: { item: CatalogItem }) {
  const Icon = (item.groceryCategoryId && GROCERY_CATEGORY_ICON[item.groceryCategoryId]) || ShoppingBasket;
  const discountPct = item.mrp && item.mrp > item.price ? Math.round(((item.mrp - item.price) / item.mrp) * 100) : 0;

  return (
    <div className="flex flex-col rounded-xl2 border border-black/5 bg-white p-2.5 shadow-sm">
      <div className="relative flex h-20 w-full items-center justify-center rounded-lg bg-accentSoft text-accentDark">
        <Icon size={26} strokeWidth={1.6} />
        {discountPct > 0 && (
          <span className="absolute left-1 top-1 rounded bg-emerald-600 px-1 py-0.5 text-[9px] font-bold text-white">{discountPct}% OFF</span>
        )}
      </div>

      <p className="mt-2 line-clamp-2 text-xs font-medium leading-snug text-ink">{item.title}</p>
      {item.weight && <p className="mt-0.5 text-[11px] text-ink/45">{item.weight}</p>}

      <div className="mt-1.5 flex items-baseline gap-1.5">
        <p className="text-sm font-bold text-ink">₹{item.price.toLocaleString("en-IN")}</p>
        {discountPct > 0 && <p className="text-[10px] text-ink/35 line-through">₹{item.mrp!.toLocaleString("en-IN")}</p>}
      </div>

      <div className="mt-2">
        <QtyStepper itemId={item.id} />
      </div>
    </div>
  );
}
