"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NOTE_COLORS, NOTE_EMOJIS, NOTE_TTL_MS, STORY_TTL_MS, noteColor, useChatStore } from "@/lib/store/useChatStore";
import { ChevronLeft, Trash2, Lock, UserCircle2, Check, Plus, X, Camera, Image as ImageIcon, Phone, Video, UserPlus } from "lucide-react";
import clsx from "clsx";

export default function ChatIndexPage() {
  const router = useRouter();
  const identity = useChatStore((s) => s.identity);
  const contacts = useChatStore((s) => s.contacts);
  const messagesByContact = useChatStore((s) => s.messagesByContact);
  const unreadByContact = useChatStore((s) => s.unreadByContact);
  const connectionStatus = useChatStore((s) => s.connectionStatus);
  const ensureIdentity = useChatStore((s) => s.ensureIdentity);
  const removeContact = useChatStore((s) => s.removeContact);
  const connect = useChatStore((s) => s.connect);
  const startCall = useChatStore((s) => s.startCall);
  const call = useChatStore((s) => s.call);

  const myStory = useChatStore((s) => s.myStory);
  const myNote = useChatStore((s) => s.myNote);
  const setMyStory = useChatStore((s) => s.setMyStory);
  const clearMyStory = useChatStore((s) => s.clearMyStory);
  const setMyNote = useChatStore((s) => s.setMyNote);
  const clearMyNote = useChatStore((s) => s.clearMyNote);

  const [showStorySheet, setShowStorySheet] = useState(false);
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteEmoji, setNoteEmoji] = useState<string | undefined>(undefined);
  const [noteColorId, setNoteColorId] = useState("default");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      await ensureIdentity();
      connect();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Story/note are only local right now (see the plan's scoping note) — a
  // page-load check is enough for expiry, no live timer needed.
  const storyActive = Boolean(myStory && Date.now() - myStory.createdAt < STORY_TTL_MS);
  const noteActive = Boolean(myNote && Date.now() - myNote.createdAt < NOTE_TTL_MS);

  function handleGalleryStory(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setMyStory(reader.result);
        setShowStorySheet(false);
      }
    };
    reader.readAsDataURL(file);
  }

  function submitNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteText.trim()) return;
    setMyNote(noteText, { emoji: noteEmoji, color: noteColorId });
    setShowNoteInput(false);
  }

  function openNoteInput() {
    setNoteText(noteActive ? myNote!.text : "");
    setNoteEmoji(noteActive ? myNote!.emoji : undefined);
    setNoteColorId(noteActive ? (myNote!.color ?? "default") : "default");
    setShowNoteInput(true);
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

      {!identity?.username && (
        <Link
          href="/profile"
          className="mt-4 flex items-center gap-2 rounded-xl2 border border-black/5 bg-accentSoft px-4 py-3 text-xs font-medium text-accentDark shadow-sm transition hover:brightness-95"
        >
          <UserCircle2 size={16} className="shrink-0" />
          Set a username in your Profile so others can find you →
        </Link>
      )}

      {/* Stories row */}
      <div className="mt-5 flex gap-4 overflow-x-auto pb-1">
        <div className="flex shrink-0 flex-col items-center gap-1.5">
          <button
            onClick={openNoteInput}
            className={clsx("max-w-[90px] truncate rounded-2xl rounded-bl-sm border px-2.5 py-1 text-[10px] shadow-sm", !noteActive && "border-black/5 bg-white text-ink/35")}
            style={
              noteActive
                ? {
                    background: `linear-gradient(135deg, ${noteColor(myNote!.color).from}, ${noteColor(myNote!.color).to})`,
                    color: noteColor(myNote!.color).text,
                    borderColor: "transparent",
                  }
                : undefined
            }
          >
            {noteActive ? (
              <>
                {myNote!.emoji && <span className="mr-1">{myNote!.emoji}</span>}
                {myNote!.text}
              </>
            ) : (
              "Note..."
            )}
          </button>
          <button onClick={() => (storyActive ? setShowStoryViewer(true) : setShowStorySheet(true))} className="relative">
            <div
              className={clsx(
                "flex h-14 w-14 items-center justify-center rounded-full p-0.5",
                storyActive ? "bg-gradient-to-br from-accent to-[#c98f00]" : "bg-black/10"
              )}
            >
              <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-paper">
                {identity?.avatarDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={identity.avatarDataUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-sm font-semibold text-accentDark">{(identity?.username ?? "?").slice(0, 1).toUpperCase()}</span>
                )}
              </div>
            </div>
            {!storyActive && (
              <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-ink ring-2 ring-paper">
                <Plus size={12} />
              </span>
            )}
          </button>
          <span className="text-[10px] text-ink/50">Your story</span>
        </div>

        {contacts.map((c) => (
          <Link key={c.id} href={`/chat/${c.id}`} className="flex shrink-0 flex-col items-center gap-1.5">
            <div className="mt-[26px] flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-black/5">
              {c.avatarDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.avatarDataUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-sm font-semibold text-ink/50">{c.username.slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            <span className="max-w-[56px] truncate text-[10px] text-ink/50">{c.username}</span>
          </Link>
        ))}
      </div>

      <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-ink/40">Chats</p>

      <div className="mt-3 space-y-2">
        {contacts.length === 0 ? (
          <p className="mt-8 text-center text-sm text-ink/40">
            No contacts yet — tap "New chat" to add someone by username.
          </p>
        ) : (
          contacts.map((c) => {
            const msgs = messagesByContact[c.id] ?? [];
            const last = msgs[msgs.length - 1];
            const unread = unreadByContact[c.id] ?? 0;
            const lastPreview = last ? (last.imageDataUrl && !last.text ? "📷 Photo" : last.text) : "No messages yet";
            return (
              <div key={c.id} className="flex items-center gap-2">
                <Link
                  href={`/chat/${c.id}`}
                  className="flex flex-1 items-center gap-3 rounded-xl2 border border-black/5 bg-white p-3 shadow-sm hover:border-accentDark/40"
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
                    <p className="truncate text-xs text-ink/45">{lastPreview}</p>
                  </div>
                  {unread > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-ink">
                      {unread}
                    </span>
                  )}
                </Link>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    startCall(c.id, "audio");
                  }}
                  disabled={!!call || connectionStatus !== "online"}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink/40 hover:bg-accentSoft hover:text-accentDark disabled:opacity-30"
                  title="Voice call"
                >
                  <Phone size={16} />
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    startCall(c.id, "video");
                  }}
                  disabled={!!call || connectionStatus !== "online"}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink/40 hover:bg-accentSoft hover:text-accentDark disabled:opacity-30"
                  title="Video call"
                >
                  <Video size={16} />
                </button>
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

      {/* Bottom-right add-contact FAB, floating just above the bottom nav. */}
      <Link
        href="/chat/new"
        className="fixed bottom-[76px] right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-ink shadow-lg transition active:scale-95"
        title="New chat"
      >
        <UserPlus size={22} />
      </Link>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleGalleryStory} />

      {showStorySheet && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/40" onClick={() => setShowStorySheet(false)}>
          <div className="w-full rounded-t-2xl bg-white p-4 pb-6" onClick={(e) => e.stopPropagation()}>
            <p className="mb-3 text-center text-sm font-semibold text-ink">Add to your story</p>
            <button
              onClick={() => {
                setShowStorySheet(false);
                router.push("/snap?for=story");
              }}
              className="flex w-full items-center gap-3 rounded-xl2 px-3 py-3 text-left text-sm text-ink hover:bg-black/[0.03]"
            >
              <Camera size={18} className="text-accentDark" /> Take a photo
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center gap-3 rounded-xl2 px-3 py-3 text-left text-sm text-ink hover:bg-black/[0.03]"
            >
              <ImageIcon size={18} className="text-accentDark" /> Choose from gallery
            </button>
            <button
              onClick={() => setShowStorySheet(false)}
              className="mt-1 w-full rounded-xl2 px-3 py-3 text-center text-sm text-ink/50 hover:bg-black/[0.03]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showStoryViewer && storyActive && myStory && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/90 p-6" onClick={() => setShowStoryViewer(false)}>
          <div className="relative w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={myStory.dataUrl} alt="Your story" className="w-full rounded-xl2" />
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-white/60">{new Date(myStory.createdAt).toLocaleString()}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    clearMyStory();
                    setShowStoryViewer(false);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                >
                  <Trash2 size={14} />
                </button>
                <button
                  onClick={() => setShowStoryViewer(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showNoteInput && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/40" onClick={() => setShowNoteInput(false)}>
          <form onSubmit={submitNote} className="w-full rounded-t-2xl bg-white p-4 pb-6" onClick={(e) => e.stopPropagation()}>
            <p className="mb-3 text-sm font-semibold text-ink">Share a thought</p>

            {/* Live preview, styled exactly like the row bubble it becomes */}
            <div className="flex justify-center">
              <div
                className="max-w-[220px] truncate rounded-2xl rounded-bl-sm px-4 py-2 text-sm shadow-sm"
                style={{ background: `linear-gradient(135deg, ${noteColor(noteColorId).from}, ${noteColor(noteColorId).to})`, color: noteColor(noteColorId).text }}
              >
                {noteEmoji && <span className="mr-1">{noteEmoji}</span>}
                {noteText.trim() || <span className="opacity-50">What's on your mind?</span>}
              </div>
            </div>

            <input
              autoFocus
              value={noteText}
              onChange={(e) => setNoteText(e.target.value.slice(0, 60))}
              placeholder="What's on your mind?"
              className="mt-3 w-full rounded-xl border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-accentDark"
            />
            <p className="mt-1 text-right text-[10px] text-ink/30">{noteText.length}/60 · visible for 24h</p>

            <p className="mt-3 text-[11px] font-medium text-ink/50">Background</p>
            <div className="mt-1.5 flex gap-2">
              {NOTE_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setNoteColorId(c.id)}
                  title={c.label}
                  className={clsx("h-7 w-7 shrink-0 rounded-full border-2", noteColorId === c.id ? "border-ink" : "border-transparent")}
                  style={{ background: `linear-gradient(135deg, ${c.from}, ${c.to})` }}
                />
              ))}
            </div>

            <p className="mt-3 text-[11px] font-medium text-ink/50">Emoji badge</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setNoteEmoji(undefined)}
                className={clsx(
                  "flex h-8 w-8 items-center justify-center rounded-full border text-xs text-ink/40",
                  !noteEmoji ? "border-ink" : "border-black/10"
                )}
                title="None"
              >
                <X size={13} />
              </button>
              {NOTE_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setNoteEmoji(e)}
                  className={clsx("flex h-8 w-8 items-center justify-center rounded-full border text-base", noteEmoji === e ? "border-ink bg-accentSoft" : "border-transparent")}
                >
                  {e}
                </button>
              ))}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                disabled={!noteText.trim()}
                className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-ink disabled:opacity-40"
              >
                Share
              </button>
              {noteActive && (
                <button
                  type="button"
                  onClick={() => {
                    clearMyNote();
                    setShowNoteInput(false);
                  }}
                  className="rounded-full px-4 py-2 text-xs text-red-500"
                >
                  Clear note
                </button>
              )}
              <button type="button" onClick={() => setShowNoteInput(false)} className="rounded-full px-4 py-2 text-xs text-ink/50">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
