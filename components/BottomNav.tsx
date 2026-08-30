"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, Camera, MessageCircle, Compass, ListChecks, Wallet, User } from "lucide-react";
import clsx from "clsx";
import { useChatStore } from "@/lib/store/useChatStore";

const TABS = [
  { href: "/", label: "AI", icon: Sparkles },
  { href: "/snap", label: "Snap", icon: Camera },
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/activity", label: "Activity", icon: ListChecks },
  { href: "/wallet", label: "Payments", icon: Wallet },
  { href: "/profile", label: "Profile", icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();
  const unreadByContact = useChatStore((s) => s.unreadByContact);
  const totalUnread = Object.values(unreadByContact).reduce((a, b) => a + b, 0);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-black/5 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-md items-stretch justify-between px-0.5">
        {TABS.map((tab) => {
          const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={clsx(
                "relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[9.5px] font-medium transition-colors",
                active ? "text-accentDark" : "text-ink/40 hover:text-ink/70"
              )}
            >
              <span className="relative">
                <Icon size={18} strokeWidth={active ? 2.4 : 1.8} />
                {tab.href === "/chat" && totalUnread > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent px-0.5 text-[8px] font-bold text-ink">
                    {totalUnread > 9 ? "9+" : totalUnread}
                  </span>
                )}
              </span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
