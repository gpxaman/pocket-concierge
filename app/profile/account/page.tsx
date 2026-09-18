"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAppStore } from "@/lib/store/useAppStore";
import { useChatStore } from "@/lib/store/useChatStore";
import { ChevronLeft, Pencil, Check } from "lucide-react";

export default function ProfileAccountPage() {
  const displayName = useAppStore((s) => s.displayName);
  const setDisplayName = useAppStore((s) => s.setDisplayName);

  const identity = useChatStore((s) => s.identity);
  const usernameStatus = useChatStore((s) => s.usernameStatus);
  const claimUsername = useChatStore((s) => s.claimUsername);
  const ensureIdentity = useChatStore((s) => s.ensureIdentity);
  const connect = useChatStore((s) => s.connect);
  const setOwnPhone = useChatStore((s) => s.setOwnPhone);
  const setOwnAvatar = useChatStore((s) => s.setOwnAvatar);

  const [usernameInput, setUsernameInput] = useState("");
  const [editingUsername, setEditingUsername] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Same head-start pattern as the old inline Account section — claimUsername
  // needs an already-OPEN socket, and new WebSocket(...) takes a beat.
  useEffect(() => {
    (async () => {
      await ensureIdentity();
      connect();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleAvatarSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setOwnAvatar(reader.result);
    };
    reader.readAsDataURL(file);
  }

  async function handleSetUsername(e: React.FormEvent) {
    e.preventDefault();
    const result = await claimUsername(usernameInput);
    if (result.ok) {
      setUsernameInput("");
      setEditingUsername(false);
    }
  }

  return (
    <div className="px-5 pt-6 pb-8">
      <Link href="/profile" className="inline-flex items-center gap-1 text-sm text-ink/50 hover:text-ink">
        <ChevronLeft size={16} /> Profile
      </Link>
      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-accentDark">Name & username</p>
      <h1 className="mt-1 text-2xl font-semibold text-ink">Account</h1>

      <div className="mt-6 rounded-xl2 border border-black/5 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => avatarInputRef.current?.click()} className="group relative shrink-0" title="Change photo">
            {identity?.avatarDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={identity.avatarDataUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accentSoft text-lg font-semibold text-accentDark">
                {(displayName || "?").slice(0, 1).toUpperCase()}
              </div>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-white ring-2 ring-white">
              <Pencil size={10} />
            </span>
          </button>
          <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarSelected} />
          <p className="text-[11px] text-ink/40">Prototype placeholder — tap to pick a photo from your device.</p>
        </div>

        <label className="mt-5 block text-xs font-semibold uppercase tracking-wide text-ink/40">What should I call you?</label>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Aman"
          className="mt-1.5 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-accentDark"
        />

        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/40">Chat username</p>
          <p className="mt-0.5 text-[11px] text-ink/40">Lets others find and message you — end-to-end encrypted.</p>

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
              {usernameStatus === "taken" && <p className="mt-1 text-xs text-red-500">That username&apos;s taken — try another.</p>}
              {usernameStatus === "invalid" && (
                <p className="mt-1 text-xs text-red-500">3-20 letters, numbers or underscores only.</p>
              )}
            </form>
          )}
          {identity?.username && !editingUsername && (
            <p className="mt-2 inline-flex items-center gap-1 text-[10px] text-ink/30">
              <Check size={10} /> Signed in as @{identity.username}
            </p>
          )}
        </div>

        <div className="mt-5">
          <label className="text-xs font-semibold uppercase tracking-wide text-ink/40">Phone number</label>
          <p className="mt-0.5 text-[11px] text-ink/40">Shown to contacts you add — lets us build smarter features later.</p>
          <input
            type="tel"
            value={identity?.phone ?? ""}
            onChange={(e) => setOwnPhone(e.target.value)}
            placeholder="+91 98765 43210"
            className="mt-1.5 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-accentDark"
          />
        </div>
      </div>
    </div>
  );
}
