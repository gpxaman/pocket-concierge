"use client";

import { ReactNode } from "react";
import { ChevronDown, LucideIcon } from "lucide-react";
import clsx from "clsx";

export default function AccordionSection({
  icon: Icon,
  title,
  subtitle,
  open,
  onToggle,
  badge,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl2 border border-black/5 bg-white shadow-sm">
      <button onClick={onToggle} className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left">
        <span className="inline-flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accentSoft text-accentDark">
            <Icon size={16} strokeWidth={1.8} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-ink">{title}</span>
            {subtitle && <span className="block truncate text-[11px] text-ink/45">{subtitle}</span>}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {badge}
          <ChevronDown size={16} className={clsx("text-ink/40 transition-transform", open && "rotate-180")} />
        </span>
      </button>
      {open && <div className="border-t border-black/5 px-4 py-4">{children}</div>}
    </div>
  );
}
