"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, Camera, MessageCircle, Compass, User } from "lucide-react";
import clsx from "clsx";
import { useChatStore } from "@/lib/store/useChatStore";

const TABS = [
  { href: "/", label: "AI", icon: Sparkles },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/profile", label: "Profile", icon: User },
];

function NavItem({ tab, active }: { tab: (typeof TABS)[number]; active: boolean }) {
  const unreadByContact = useChatStore((s) => s.unreadByContact);
  const totalUnread = Object.values(unreadByContact).reduce((a, b) => a + b, 0);
  const Icon = tab.icon;
  return (
    <Link
      href={tab.href}
      className={clsx(
        "flex flex-col items-center justify-center gap-0.5 py-2.5 text-[9.5px] font-medium transition-colors",
        active ? "text-accentDark" : "text-ink/40 hover:text-ink/70"
      )}
    >
      <span className="relative">
        <Icon size={18} strokeWidth={active ? 2.4 : 1.8} />
        {tab.href === "/chat" && totalUnread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-3 min-w-3 items-center justify-center rounded-full bg-accent px-0.5 text-[7px] font-bold text-ink">
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        )}
      </span>
      {tab.label}
    </Link>
  );
}

export default function BottomNav() {
  const pathname = usePathname();
  const snapActive = pathname.startsWith("/snap");

  // 5 genuinely equal grid columns (AI, Explore, Snap-slot, Chat, Profile) —
  // the elevated Snap button sits IN its own column (not absolutely
  // positioned over the row), so spacing on both sides is mathematically
  // even instead of depending on how a floating circle happens to look.
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-black/5 bg-white/90 backdrop-blur">
      <div className="mx-auto grid max-w-md grid-cols-5 items-stretch">
        {TABS.slice(0, 2).map((tab) => (
          <NavItem key={tab.href} tab={tab} active={tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href)} />
        ))}

        <div className="flex items-center justify-center">
          <Link
            href="/snap"
            className={clsx(
              "-mt-6 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition active:scale-95",
              snapActive ? "bg-ink text-accent" : "bg-accent text-ink"
            )}
            title="Snap"
          >
            <Camera size={22} strokeWidth={2} />
          </Link>
        </div>

        {TABS.slice(2).map((tab) => (
          <NavItem key={tab.href} tab={tab} active={tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href)} />
        ))}
      </div>
    </nav>
  );
}
