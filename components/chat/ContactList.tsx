"use client";

import Link from "next/link";
import { useChatStore } from "@/lib/store/useChatStore";
import { Trash2 } from "lucide-react";
import clsx from "clsx";

export default function ContactList() {
  const contacts = useChatStore((s) => s.contacts);
  const messagesByContact = useChatStore((s) => s.messagesByContact);
  const unreadByContact = useChatStore((s) => s.unreadByContact);
  const onlineIds = useChatStore((s) => s.onlineIds);
  const removeContact = useChatStore((s) => s.removeContact);

  return (
    <div className="mt-3 space-y-2">
      {contacts.length === 0 ? (
        <p className="mt-8 text-center text-sm text-ink/40">
          No contacts yet — tap &quot;New chat&quot; to add someone by username.
        </p>
      ) : (
        contacts.map((c) => {
          const msgs = messagesByContact[c.id] ?? [];
          const last = msgs[msgs.length - 1];
          const unread = unreadByContact[c.id] ?? 0;
          const lastPreview = last
            ? last.audioDataUrl
              ? "🎤 Voice message"
              : last.imageDataUrl && !last.text
                ? "📷 Photo"
                : last.text
            : "No messages yet";
          const lastIsMineRead = last?.direction === "out" && last.status === "read";
          return (
            <div key={c.id} className="flex items-center gap-2">
              <Link
                href={`/chat/${c.id}`}
                className="flex flex-1 items-center gap-3 rounded-xl2 border border-black/5 bg-white p-3 shadow-sm hover:border-accentDark/40"
              >
                <span className="relative shrink-0">
                  {c.avatarDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.avatarDataUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accentSoft text-sm font-semibold text-accentDark">
                      {c.username.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  {onlineIds.has(c.id) && (
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">@{c.username}</p>
                  <p className={clsx("truncate text-xs", lastIsMineRead ? "text-accentDark" : "text-ink/45")}>{lastPreview}</p>
                </div>
                {unread > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-ink">
                    {unread}
                  </span>
                )}
              </Link>
              <button
                onClick={() => removeContact(c.id)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink/30 hover:text-red-500"
                title="Remove contact"
              >
                <Trash2 size={15} />
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}
