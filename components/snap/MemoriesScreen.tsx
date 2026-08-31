"use client";

import { useRef, useState } from "react";
import { useSnapStore } from "@/lib/store/useSnapStore";
import { Snap } from "@/lib/types";
import { ChevronLeft, Trash2, X, Image as ImageIcon } from "lucide-react";
import clsx from "clsx";

export default function MemoriesScreen({ onBack, onPick }: { onBack: () => void; onPick: (dataUrl: string) => void }) {
  const snaps = useSnapStore((s) => s.snaps);
  const deleteSnap = useSnapStore((s) => s.deleteSnap);

  const [tab, setTab] = useState<"memories" | "roll">("memories");
  const [preview, setPreview] = useState<Snap | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") onPick(reader.result);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col px-5 pt-6 pb-8">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-ink/50 hover:text-ink">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-xl font-semibold text-ink">Memories</h1>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => setTab("memories")}
          className={clsx(
            "rounded-full border px-3 py-1.5 text-xs font-medium transition",
            tab === "memories" ? "border-ink bg-ink text-white" : "border-black/10 bg-white text-ink/70"
          )}
        >
          Memories
        </button>
        <button
          onClick={() => setTab("roll")}
          className={clsx(
            "rounded-full border px-3 py-1.5 text-xs font-medium transition",
            tab === "roll" ? "border-ink bg-ink text-white" : "border-black/10 bg-white text-ink/70"
          )}
        >
          Camera Roll
        </button>
      </div>

      {tab === "memories" ? (
        snaps.length === 0 ? (
          <p className="mt-10 text-center text-sm text-ink/40">No memories yet — snaps you save land here.</p>
        ) : (
          <div className="mt-4 grid grid-cols-3 gap-2 overflow-y-auto">
            {snaps.map((s) => (
              <button key={s.id} onClick={() => setPreview(s)} className="aspect-square overflow-hidden rounded-lg bg-ink/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.dataUrl} alt={s.filterName} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )
      ) : (
        <div className="mt-10 flex flex-col items-center gap-3 text-center">
          <ImageIcon size={32} className="text-ink/30" />
          <p className="text-sm text-ink/50">Pick a photo from your device to send or save.</p>
          <button onClick={() => fileInputRef.current?.click()} className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-ink">
            Choose from gallery
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-6" onClick={() => setPreview(null)}>
          <div className="relative w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview.dataUrl} alt={preview.filterName} className="w-full rounded-xl2" />
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-white/60">
                {preview.filterName} · {new Date(preview.createdAt).toLocaleString()}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    deleteSnap(preview.id);
                    setPreview(null);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                >
                  <Trash2 size={14} />
                </button>
                <button
                  onClick={() => setPreview(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
