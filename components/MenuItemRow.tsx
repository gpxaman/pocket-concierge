import clsx from "clsx";
import { UtensilsCrossed } from "lucide-react";
import { CatalogItem } from "@/lib/types";
import QtyStepper from "@/components/QtyStepper";

function VegDot({ veg }: { veg: boolean }) {
  return (
    <span className={clsx("flex h-3.5 w-3.5 shrink-0 items-center justify-center border", veg ? "border-emerald-600" : "border-red-600")}>
      <span className={clsx("h-1.5 w-1.5 rounded-full", veg ? "bg-emerald-600" : "bg-red-600")} />
    </span>
  );
}

export default function MenuItemRow({ item, onRestaurantSwitch }: { item: CatalogItem; onRestaurantSwitch?: () => void }) {
  return (
    <div className="flex gap-3 border-b border-black/5 py-4 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <VegDot veg={item.veg ?? true} />
          {item.isBestseller && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700">Bestseller</span>
          )}
        </div>
        <p className="mt-1 text-sm font-semibold text-ink">{item.title}</p>
        <p className="mt-0.5 text-xs font-medium text-ink/70">₹{item.price.toLocaleString("en-IN")}</p>
        {item.subtitle && <p className="mt-1 line-clamp-2 text-xs text-ink/45">{item.subtitle}</p>}
      </div>

      <div className="flex w-24 shrink-0 flex-col items-center gap-2">
        <div className="flex h-20 w-24 items-center justify-center rounded-xl bg-accentSoft text-accentDark">
          <UtensilsCrossed size={26} strokeWidth={1.5} />
        </div>
        <QtyStepper itemId={item.id} onRestaurantSwitch={onRestaurantSwitch} />
      </div>
    </div>
  );
}
