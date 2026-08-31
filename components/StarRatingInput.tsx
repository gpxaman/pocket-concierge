"use client";

import { Star } from "lucide-react";
import clsx from "clsx";

export default function StarRatingInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} className="p-1" aria-label={`${n} star${n > 1 ? "s" : ""}`}>
          <Star size={30} className={clsx(n <= value ? "fill-accent text-accent" : "text-black/15")} />
        </button>
      ))}
    </div>
  );
}
