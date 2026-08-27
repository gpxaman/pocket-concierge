"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, Compass, ListChecks, Wallet, User } from "lucide-react";
import clsx from "clsx";

const TABS = [
  { href: "/", label: "AI", icon: Sparkles },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/activity", label: "Activity", icon: ListChecks },
  { href: "/wallet", label: "Payments", icon: Wallet },
  { href: "/profile", label: "Profile", icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-black/5 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-md items-stretch justify-between px-2">
        {TABS.map((tab) => {
          const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={clsx(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                active ? "text-accentDark" : "text-ink/40 hover:text-ink/70"
              )}
            >
              <Icon size={20} strokeWidth={active ? 2.4 : 1.8} />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
