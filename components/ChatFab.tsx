"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { useChatStore } from "@/lib/store/useChatStore";

export default function ChatFab() {
  const pathname = usePathname();
  const unreadByContact = useChatStore((s) => s.unreadByContact);
  const totalUnread = Object.values(unreadByContact).reduce((a, b) => a + b, 0);

  if (pathname.startsWith("/chat")) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-20">
      <div className="relative mx-auto h-full max-w-md">
        <Link
          href="/chat"
          className="pointer-events-auto absolute bottom-24 right-4 flex h-12 w-12 items-center justify-center rounded-full bg-ink text-white shadow-lg transition hover:scale-105"
          title="Messages"
        >
          <MessageCircle size={20} />
          {totalUnread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-ink">
              {totalUnread}
            </span>
          )}
        </Link>
      </div>
    </div>
  );
}
