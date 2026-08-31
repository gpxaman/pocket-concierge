"use client";

import { useState } from "react";
import { X } from "lucide-react";
import clsx from "clsx";
import { NOTE_EMOJIS } from "@/lib/store/useChatStore";

// Curated grid, not a full Unicode emoji library — matches the app's existing
// lightweight-preset approach (see NOTE_EMOJIS). Smileys reuses that set
// instead of duplicating it.
const CATEGORIES: { label: string; emojis: string[] }[] = [
  { label: "Smileys", emojis: [...NOTE_EMOJIS, "😅", "😆", "🙂", "😉", "😎", "🥳", "😢", "😭", "😡", "😱", "🥰", "😘", "🤗", "🤩", "🫡", "🙃", "😇", "🤯", "🥹", "😬"] },
  { label: "Gestures", emojis: ["👍", "👎", "👏", "🙌", "🤝", "🤞", "✌️", "🤘", "👌", "🫶", "💪", "🖐️", "✋", "🫡", "🤙", "☝️", "👆", "👇", "👈", "👉"] },
  { label: "Hearts", emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "❣️", "💌"] },
  { label: "Objects", emojis: ["🎉", "🎂", "🎁", "⭐", "✨", "🔥", "💯", "🎶", "📷", "💻", "📱", "⏰", "💡", "🔑", "💰", "🎯", "🏆", "🚀", "🌈", "☀️"] },
  { label: "Nature", emojis: ["🌸", "🌺", "🌻", "🌼", "🌷", "🍀", "🌙", "⭐", "☁️", "🌧️", "❄️", "🐶", "🐱", "🐼", "🦋", "🌊", "🍕", "🍔", "☕", "🍩"] },
];

export default function EmojiPicker({ onPick, onClose }: { onPick: (emoji: string) => void; onClose: () => void }) {
  const [tab, setTab] = useState(0);

  return (
    <div className="border-t border-black/5 bg-white">
      <div className="flex items-center justify-between px-3 pt-2">
        <div className="flex gap-1 overflow-x-auto">
          {CATEGORIES.map((c, i) => (
            <button
              key={c.label}
              onClick={() => setTab(i)}
              className={clsx(
                "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition",
                tab === i ? "bg-accentSoft text-accentDark" : "text-ink/40 hover:text-ink/70"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink/40 hover:bg-black/5">
          <X size={15} />
        </button>
      </div>
      <div className="grid max-h-40 grid-cols-8 gap-1 overflow-y-auto px-3 py-2">
        {CATEGORIES[tab].emojis.map((e, i) => (
          <button
            key={`${e}-${i}`}
            onClick={() => onPick(e)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-lg hover:bg-black/5"
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
