"use client";

import { useEffect, useRef, useState } from "react";
import { useSnapStore } from "@/lib/store/useSnapStore";
import { BUILTIN_PRESETS, filterToCss } from "@/lib/filters";
import { FilterSettings, Snap } from "@/lib/types";
import { Camera, CameraOff, Trash2, X } from "lucide-react";
import clsx from "clsx";

type NamedFilter = FilterSettings & { id: string; name: string };

export default function SnapPage() {
  const creatorFilters = useSnapStore((s) => s.filters);
  const snaps = useSnapStore((s) => s.snaps);
  const addSnap = useSnapStore((s) => s.addSnap);
  const deleteSnap = useSnapStore((s) => s.deleteSnap);

  const allFilters: NamedFilter[] = [...BUILTIN_PRESETS, ...creatorFilters];
  const [selectedId, setSelectedId] = useState(allFilters[0].id);
  const selected = allFilters.find((f) => f.id === selectedId) ?? allFilters[0];

  const [permission, setPermission] = useState<"pending" | "granted" | "denied">("pending");
  const [justCaptured, setJustCaptured] = useState<string | null>(null);
  const [preview, setPreview] = useState<Snap | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setPermission("granted");
      } catch {
        if (!cancelled) setPermission("denied");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function capture() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.filter = filterToCss(selected);
    // Mirror horizontally to match the on-screen preview (front camera feels
    // wrong unmirrored — this only affects the saved image, not the live feed).
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    addSnap(dataUrl, selected.name);
    setJustCaptured(dataUrl);
    setTimeout(() => setJustCaptured(null), 900);
  }

  return (
    <div className="px-5 pt-6 pb-8">
      <p className="text-xs font-medium uppercase tracking-wide text-accentDark">Camera</p>
      <h1 className="mt-1 text-2xl font-semibold text-ink">Snap</h1>

      <div className="relative mt-4 aspect-[3/4] w-full overflow-hidden rounded-xl2 bg-ink">
        {permission === "denied" && (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-white/60">
            <CameraOff size={28} />
            <p className="text-sm">Camera access was denied — allow it in your browser's site settings to use Snap.</p>
          </div>
        )}
        {permission !== "denied" && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover [transform:scaleX(-1)]"
            style={{ filter: filterToCss(selected) }}
          />
        )}
        {justCaptured && (
          <div className="pointer-events-none absolute inset-0 bg-white/80 transition-opacity" />
        )}
        {permission === "pending" && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-white/50">Starting camera…</div>
        )}
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {allFilters.map((f) => (
          <button
            key={f.id}
            onClick={() => setSelectedId(f.id)}
            className={clsx(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition",
              selectedId === f.id ? "border-ink bg-ink text-white" : "border-black/10 bg-white text-ink/70"
            )}
          >
            {f.name}
          </button>
        ))}
      </div>

      <div className="mt-4 flex justify-center">
        <button
          onClick={capture}
          disabled={permission !== "granted"}
          className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-accent bg-white shadow-md transition active:scale-95 disabled:opacity-30"
          title="Capture"
        >
          <Camera size={26} className="text-ink" />
        </button>
      </div>

      {snaps.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-sm font-semibold text-ink/70">Your snaps</p>
          <div className="grid grid-cols-3 gap-2">
            {snaps.map((s) => (
              <button
                key={s.id}
                onClick={() => setPreview(s)}
                className="group relative aspect-square overflow-hidden rounded-lg bg-ink/5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.dataUrl} alt={s.filterName} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-6" onClick={() => setPreview(null)}>
          <div className="relative w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview.dataUrl} alt={preview.filterName} className="w-full rounded-xl2" />
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-white/60">{preview.filterName} · {new Date(preview.createdAt).toLocaleString()}</p>
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
