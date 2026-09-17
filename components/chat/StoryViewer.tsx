"use client";

// Shared by both "view your own story" (which can delete) and "view a
// contact's story" (which can't) — the two were near-identical JSX blocks
// in the original page, differing only in the caption line and whether a
// delete button is shown.
import { Trash2, X } from "lucide-react";

export default function StoryViewer({
  dataUrl,
  caption,
  onClose,
  onDelete,
}: {
  dataUrl: string;
  caption: string;
  onClose: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/90 p-6" onClick={onClose}>
      <div className="relative w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={dataUrl} alt="Story" className="w-full rounded-xl2" />
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-white/60">{caption}</p>
          <div className="flex gap-2">
            {onDelete && (
              <button
                onClick={onDelete}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                <Trash2 size={14} />
              </button>
            )}
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
