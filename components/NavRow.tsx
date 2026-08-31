"use client";

import Link from "next/link";
import { ChevronRight, LucideIcon } from "lucide-react";

/** Same visual language as AccordionSection, but navigates to a real screen instead of expanding inline — for sections whose content is too long to feel right in a dropdown. */
export default function NavRow({ href, icon: Icon, title, subtitle }: { href: string; icon: LucideIcon; title: string; subtitle?: string }) {
  return (
    <Link href={href} className="flex items-center justify-between gap-3 rounded-xl2 border border-black/5 bg-white px-4 py-3.5 shadow-sm">
      <span className="inline-flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accentSoft text-accentDark">
          <Icon size={16} strokeWidth={1.8} />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-ink">{title}</span>
          {subtitle && <span className="block truncate text-[11px] text-ink/45">{subtitle}</span>}
        </span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-ink/40" />
    </Link>
  );
}
