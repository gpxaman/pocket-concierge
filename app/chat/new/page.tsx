"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useChatStore } from "@/lib/store/useChatStore";
import { ChevronLeft, Search, UserPlus } from "lucide-react";

export default function NewChatPage() {
  const router = useRouter();
  const contacts = useChatStore((s) => s.contacts);
  const addContactByUsername = useChatStore((s) => s.addContactByUsername);
  const ensureIdentity = useChatStore((s) => s.ensureIdentity);
  const connect = useChatStore((s) => s.connect);

  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A direct landing on this route (not a client-side transition from an
  // already-connected chat screen) would otherwise have no live socket —
  // addContactByUsername needs one open to look anyone up.
  useEffect(() => {
    (async () => {
      await ensureIdentity();
      connect();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = query.trim()
    ? contacts.filter((c) => c.username.toLowerCase().includes(query.trim().toLowerCase()))
    : contacts;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const username = query.trim();
    if (!username) return;
    setAdding(true);
    setError(null);
    const result = await addContactByUsername(username);
    setAdding(false);
    if (result.ok) {
      setQuery("");
      router.push(`/chat/${result.contact.id}`);
    } else {
      setError(
        result.reason === "self"
          ? "That's you."
          : result.reason === "not_found"
            ? "No one with that username."
            : result.reason === "offline"
              ? "You're offline — check your connection."
              : "Enter a valid username (3-20 letters, numbers or underscores)."
      );
    }
  }

  return (
    <div className="px-5 pt-6 pb-8">
      <div className="flex items-center gap-3">
        <Link href="/chat" className="text-ink/50 hover:text-ink">
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-xl font-semibold text-ink">New chat</h1>
      </div>

      <form onSubmit={handleAdd} className="mt-4 flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-2.5 shadow-sm">
        <Search size={16} className="shrink-0 text-ink/35" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search or add by username"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink/35"
        />
        <button
          type="submit"
          disabled={adding || !query.trim()}
          className="flex shrink-0 items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-40"
        >
          <UserPlus size={13} /> {adding ? "Adding…" : "Add"}
        </button>
      </form>
      {error && <p className="mt-2 px-1 text-xs text-red-500">{error}</p>}

      <p className="mt-6 mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-ink/40">
        {query.trim() ? "Matching contacts" : "Your contacts"}
      </p>
      {filtered.length === 0 ? (
        <p className="px-1 text-sm text-ink/40">
          {query.trim() ? "No saved contacts match — tap Add to look them up by username." : "No contacts yet."}
        </p>
      ) : (
        <div className="space-y-1">
          {filtered.map((c) => (
            <Link
              key={c.id}
              href={`/chat/${c.id}`}
              className="flex items-center gap-3 rounded-xl2 px-2 py-2.5 hover:bg-black/[0.03]"
            >
              {c.avatarDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.avatarDataUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accentSoft text-sm font-semibold text-accentDark">
                  {c.username.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">@{c.username}</p>
                {c.phone && <p className="truncate text-xs text-ink/40">{c.phone}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
