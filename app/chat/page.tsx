"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NOTE_TTL_MS, STORY_TTL_MS, StoryItem, useChatStore } from "@/lib/store/useChatStore";
import { readImageFile } from "@/lib/imagePicker";
import StoriesRow from "@/components/chat/StoriesRow";
import StoryViewer from "@/components/chat/StoryViewer";
import NoteComposer from "@/components/chat/NoteComposer";
import ContactList from "@/components/chat/ContactList";
import { ChevronLeft, Lock, UserCircle2, Check, Camera, Image as ImageIcon, UserPlus } from "lucide-react";
import clsx from "clsx";

export default function ChatIndexPage() {
  const router = useRouter();
  const identity = useChatStore((s) => s.identity);
  const connectionStatus = useChatStore((s) => s.connectionStatus);
  const ensureIdentity = useChatStore((s) => s.ensureIdentity);
  const connect = useChatStore((s) => s.connect);

  const myStory = useChatStore((s) => s.myStory);
  const myNote = useChatStore((s) => s.myNote);
  const setMyStory = useChatStore((s) => s.setMyStory);
  const clearMyStory = useChatStore((s) => s.clearMyStory);

  const [showStorySheet, setShowStorySheet] = useState(false);
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [viewingContactStory, setViewingContactStory] = useState<{ username: string; story: StoryItem } | null>(null);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      await ensureIdentity();
      connect();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const storyActive = Boolean(myStory && Date.now() - myStory.createdAt < STORY_TTL_MS);
  const noteActive = Boolean(myNote && Date.now() - myNote.createdAt < NOTE_TTL_MS);

  async function handleGalleryStory(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = await readImageFile(e);
    if (picked) {
      setMyStory(picked.dataUrl);
      setShowStorySheet(false);
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

      {!identity?.username && (
        <Link
          href="/profile"
          className="mt-4 flex items-center gap-2 rounded-xl2 border border-black/5 bg-accentSoft px-4 py-3 text-xs font-medium text-accentDark shadow-sm transition hover:brightness-95"
        >
          <UserCircle2 size={16} className="shrink-0" />
          Set a username in your Profile so others can find you →
        </Link>
      )}

      <StoriesRow
        onOpenNoteInput={() => setShowNoteInput(true)}
        onOpenStorySheet={() => setShowStorySheet(true)}
        onViewMyStory={() => setShowStoryViewer(true)}
        onViewContactStory={setViewingContactStory}
      />

      <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-ink/40">Chats</p>

      <ContactList />

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
        <StoryViewer
          dataUrl={myStory.dataUrl}
          caption={new Date(myStory.createdAt).toLocaleString()}
          onClose={() => setShowStoryViewer(false)}
          onDelete={() => {
            clearMyStory();
            setShowStoryViewer(false);
          }}
        />
      )}

      {viewingContactStory && (
        <StoryViewer
          dataUrl={viewingContactStory.story.dataUrl}
          caption={`@${viewingContactStory.username} · ${new Date(viewingContactStory.story.createdAt).toLocaleString()}`}
          onClose={() => setViewingContactStory(null)}
        />
      )}

      {showNoteInput && (
        <NoteComposer
          initialText={noteActive ? myNote!.text : ""}
          initialEmoji={noteActive ? myNote!.emoji : undefined}
          initialColorId={noteActive ? (myNote!.color ?? "default") : "default"}
          noteActive={noteActive}
          onClose={() => setShowNoteInput(false)}
        />
      )}
    </div>
  );
}
