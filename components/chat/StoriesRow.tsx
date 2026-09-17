"use client";

import { useRouter } from "next/navigation";
import { NOTE_TTL_MS, STORY_TTL_MS, noteColor, StoryItem, useChatStore } from "@/lib/store/useChatStore";
import { Plus } from "lucide-react";
import clsx from "clsx";

export default function StoriesRow({
  onOpenNoteInput,
  onOpenStorySheet,
  onViewMyStory,
  onViewContactStory,
}: {
  onOpenNoteInput: () => void;
  onOpenStorySheet: () => void;
  onViewMyStory: () => void;
  onViewContactStory: (arg: { username: string; story: StoryItem }) => void;
}) {
  const router = useRouter();
  const identity = useChatStore((s) => s.identity);
  const contacts = useChatStore((s) => s.contacts);
  const onlineIds = useChatStore((s) => s.onlineIds);
  const notesByContact = useChatStore((s) => s.notesByContact);
  const storiesByContact = useChatStore((s) => s.storiesByContact);
  const myStory = useChatStore((s) => s.myStory);
  const myNote = useChatStore((s) => s.myNote);

  // Story/note are only local right now (see the plan's scoping note) — a
  // page-load check is enough for expiry, no live timer needed.
  const storyActive = Boolean(myStory && Date.now() - myStory.createdAt < STORY_TTL_MS);
  const noteActive = Boolean(myNote && Date.now() - myNote.createdAt < NOTE_TTL_MS);

  return (
    <div className="mt-5 flex gap-4 overflow-x-auto pb-1">
      <div className="flex shrink-0 flex-col items-center gap-1.5">
        <button
          onClick={onOpenNoteInput}
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
        <button onClick={() => (storyActive ? onViewMyStory() : onOpenStorySheet())} className="relative">
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

      {contacts.map((c) => {
        const contactStory = storiesByContact[c.id];
        const contactStoryActive = Boolean(contactStory && Date.now() - contactStory.createdAt < STORY_TTL_MS);
        const contactNote = notesByContact[c.id];
        const contactNoteActive = Boolean(contactNote && Date.now() - contactNote.createdAt < NOTE_TTL_MS);
        return (
          <div key={c.id} className="flex shrink-0 flex-col items-center gap-1.5">
            {contactNoteActive && contactNote && (
              <div
                className="max-w-[90px] truncate rounded-2xl rounded-bl-sm px-2.5 py-1 text-[10px] shadow-sm"
                style={{
                  background: `linear-gradient(135deg, ${noteColor(contactNote.color).from}, ${noteColor(contactNote.color).to})`,
                  color: noteColor(contactNote.color).text,
                }}
              >
                {contactNote.emoji && <span className="mr-1">{contactNote.emoji}</span>}
                {contactNote.text}
              </div>
            )}
            <button
              onClick={() => (contactStoryActive && contactStory ? onViewContactStory({ username: c.username, story: contactStory }) : router.push(`/chat/${c.id}`))}
              className={clsx(!contactNoteActive && "mt-[26px]", "relative")}
            >
              <div
                className={clsx(
                  "flex h-14 w-14 items-center justify-center rounded-full p-0.5",
                  contactStoryActive ? "bg-gradient-to-br from-accent to-[#c98f00]" : ""
                )}
              >
                <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-black/5">
                  {c.avatarDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.avatarDataUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-sm font-semibold text-ink/50">{c.username.slice(0, 1).toUpperCase()}</span>
                  )}
                </div>
              </div>
              {onlineIds.has(c.id) && (
                <span className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-paper" />
              )}
            </button>
            <span className="max-w-[56px] truncate text-[10px] text-ink/50">{c.username}</span>
          </div>
        );
      })}
    </div>
  );
}
