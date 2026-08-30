"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useChatStore } from "@/lib/store/useChatStore";
import { ChevronLeft, Plus, Trash2, Lock, Check, Pencil } from "lucide-react";
import clsx from "clsx";

export default function ChatIndexPage() {
  const identity = useChatStore((s) => s.identity);
  const usernameStatus = useChatStore((s) => s.usernameStatus);
  const contacts = useChatStore((s) => s.contacts);
  const messagesByContact = useChatStore((s) => s.messagesByContact);
  const unreadByContact = useChatStore((s) => s.unreadByContact);
  const connectionStatus = useChatStore((s) => s.connectionStatus);
  const ensureIdentity = useChatStore((s) => s.ensureIdentity);
  const claimUsername = useChatStore((s) => s.claimUsername);
  const addContactByUsername = useChatStore((s) => s.addContactByUsername);
  const removeContact = useChatStore((s) => s.removeContact);
  const connect = useChatStore((s) => s.connect);

  const [usernameInput, setUsernameInput] = useState("");
  const [editingUsername, setEditingUsername] = useState(false);
  const [addInput, setAddInput] = useState("");
  const [addError, setAddError] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    (async () => {
      await ensureIdentity();
      connect();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!identity?.username) setEditingUsername(true);
  }, [identity?.username]);

  async function handleSetUsername(e: React.FormEvent) {
    e.preventDefault();
    const result = await claimUsername(usernameInput);
    if (result.ok) {
      setUsernameInput("");
      setEditingUsername(false);
    }
  }

  async function handleAddContact(e: React.FormEvent) {
    e.preventDefault();
    setAddError("");
    const result = await addContactByUsername(addInput);
    if (result.ok) {
      setAddInput("");
      setShowAdd(false);
    } else {
      setAddError(
        result.reason === "self"
          ? "That's your own username."
          : result.reason === "not_found"
            ? "No one with that username is registered."
            : result.reason === "offline"
              ? "Not connected — try again in a moment."
              : "Usernames are 3-20 letters, numbers or underscores."
      );
    }
  }

  return (
    <div className="px-5 pt-6 pb-8">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-ink/50 hover:text-ink">
        <ChevronLeft size={16} /> Home
      </Link>

      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink">Messages</h1>
        <span
          className={clsx(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
            connectionStatus === "online" && "bg-emerald-100 text-emerald-700",
            connectionStatus === "connecting" && "bg-amber-100 text-amber-700",
            connectionStatus === "offline" && "bg-red-100 text-red-600"
          )}
        >
          <span
            className={clsx(
              "h-1.5 w-1.5 rounded-full",
              connectionStatus === "online" && "bg-emerald-500",
              connectionStatus === "connecting" && "bg-amber-500",
              connectionStatus === "offline" && "bg-red-500"
            )}
          />
          {connectionStatus}
        </span>
      </div>
      <p className="mt-1 inline-flex items-center gap-1 text-xs text-ink/40">
        <Lock size={11} /> End-to-end encrypted — the relay only ever sees ciphertext.
      </p>

      <div className="mt-5 rounded-xl2 border border-black/5 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-ink">Your username</p>
        {!editingUsername && identity?.username ? (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 rounded-lg bg-accentSoft px-3 py-2 text-sm font-medium text-ink">@{identity.username}</div>
            <button
              onClick={() => {
                setUsernameInput(identity.username ?? "");
                setEditingUsername(true);
              }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink/40 hover:text-ink"
              title="Change username"
            >
              <Pencil size={15} />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSetUsername} className="mt-2">
            <p className="mb-1.5 text-xs text-ink/50">Pick something others can find you by — letters, numbers, underscores.</p>
            <div className="flex items-center gap-2">
              <input
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="e.g. aman_k"
                className="flex-1 rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-accentDark"
              />
              <button
                type="submit"
                disabled={usernameStatus === "checking" || !usernameInput.trim()}
                className="flex h-9 shrink-0 items-center justify-center rounded-lg bg-accent px-3 text-xs font-semibold text-ink disabled:opacity-40"
              >
                {usernameStatus === "checking" ? "Checking…" : "Save"}
              </button>
            </div>
            {usernameStatus === "taken" && <p className="mt-1 text-xs text-red-500">That username's taken — try another.</p>}
            {usernameStatus === "invalid" && (
              <p className="mt-1 text-xs text-red-500">3-20 letters, numbers or underscores only.</p>
            )}
          </form>
        )}
      </div>

      <div className="mt-4">
        {!showAdd ? (
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-white hover:bg-ink/85"
          >
            <Plus size={13} /> Add a contact
          </button>
        ) : (
          <form onSubmit={handleAddContact} className="rounded-xl2 border border-black/10 bg-white p-3 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-sm text-ink/40">@</span>
              <input
                value={addInput}
                onChange={(e) => setAddInput(e.target.value)}
                placeholder="username"
                className="flex-1 rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-accentDark"
              />
            </div>
            {addError && <p className="mt-1 text-xs text-red-500">{addError}</p>}
            <div className="mt-2 flex gap-2">
              <button type="submit" className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-ink hover:brightness-95">
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAdd(false);
                  setAddError("");
                }}
                className="rounded-full px-3 py-1.5 text-xs text-ink/50 hover:text-ink"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="mt-5 space-y-2">
        {contacts.length === 0 ? (
          <p className="mt-8 text-center text-sm text-ink/40">
            No contacts yet — ask someone for their username, or share yours above.
          </p>
        ) : (
          contacts.map((c) => {
            const msgs = messagesByContact[c.id] ?? [];
            const last = msgs[msgs.length - 1];
            const unread = unreadByContact[c.id] ?? 0;
            return (
              <div key={c.id} className="flex items-center gap-2">
                <Link
                  href={`/chat/${c.id}`}
                  className="flex flex-1 items-center gap-3 rounded-xl2 border border-black/5 bg-white p-3 shadow-sm hover:border-accentDark/40"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accentSoft text-sm font-semibold text-accentDark">
                    {c.username.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">@{c.username}</p>
                    <p className="truncate text-xs text-ink/45">{last ? last.text : "No messages yet"}</p>
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

      {identity?.username && (
        <p className="mt-6 inline-flex items-center gap-1 text-[10px] text-ink/30">
          <Check size={10} /> Signed in as @{identity.username}
        </p>
      )}
    </div>
  );
}
