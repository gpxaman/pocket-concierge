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

export default function BottomNav() {
  const pathname = usePathname();
  const unreadByContact = useChatStore((s) => s.unreadByContact);
  const totalUnread = Object.values(unreadByContact).reduce((a, b) => a + b, 0);
  const snapActive = pathname.startsWith("/snap");

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-black/5 bg-white/90 backdrop-blur">
      <div className="relative mx-auto flex max-w-md items-stretch justify-between px-0.5">
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

        {/* Elevated Snap button — absolutely positioned so it doesn't take a
            flex slot, naturally centering between Explore and Chat. Rises
            modestly above the bar (not up into the bottom-20 band that
            ActiveRideBar/CartFloatingBar occupy globally). */}
        <Link
          href="/snap"
          className={clsx(
            "absolute left-1/2 -top-4 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full shadow-lg transition active:scale-95",
            snapActive ? "bg-ink text-accent" : "bg-accent text-ink"
          )}
          title="Snap"
        >
          <Camera size={22} strokeWidth={2} />
        </Link>
      </div>
    </nav>
  );
}
