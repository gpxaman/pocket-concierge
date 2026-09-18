"use client";

import { useState } from "react";
import { NOTE_COLORS, NOTE_EMOJIS, noteColor, useChatStore } from "@/lib/store/useChatStore";
import { X } from "lucide-react";
import clsx from "clsx";

export default function NoteComposer({
  initialText,
  initialEmoji,
  initialColorId,
  noteActive,
  onClose,
}: {
  initialText: string;
  initialEmoji: string | undefined;
  initialColorId: string;
  noteActive: boolean;
  onClose: () => void;
}) {
  const setMyNote = useChatStore((s) => s.setMyNote);
  const clearMyNote = useChatStore((s) => s.clearMyNote);

  const [noteText, setNoteText] = useState(initialText);
  const [noteEmoji, setNoteEmoji] = useState<string | undefined>(initialEmoji);
  const [noteColorId, setNoteColorId] = useState(initialColorId);

  function submitNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteText.trim()) return;
    setMyNote(noteText, { emoji: noteEmoji, color: noteColorId });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/40" onClick={onClose}>
      <form onSubmit={submitNote} className="w-full rounded-t-2xl bg-white p-4 pb-6" onClick={(e) => e.stopPropagation()}>
        <p className="mb-3 text-sm font-semibold text-ink">Share a thought</p>

        {/* Live preview, styled exactly like the row bubble it becomes */}
        <div className="flex justify-center">
          <div
            className="max-w-[220px] truncate rounded-2xl rounded-bl-sm px-4 py-2 text-sm shadow-sm"
            style={{ background: `linear-gradient(135deg, ${noteColor(noteColorId).from}, ${noteColor(noteColorId).to})`, color: noteColor(noteColorId).text }}
          >
            {noteEmoji && <span className="mr-1">{noteEmoji}</span>}
            {noteText.trim() || <span className="opacity-50">What&apos;s on your mind?</span>}
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
                onClose();
              }}
              className="rounded-full px-4 py-2 text-xs text-red-500"
            >
              Clear note
            </button>
          )}
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-xs text-ink/50">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
