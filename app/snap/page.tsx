"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSnapStore } from "@/lib/store/useSnapStore";
import { BUILTIN_PRESETS, filterToCss } from "@/lib/filters";
import { FilterSettings } from "@/lib/types";
import { Camera, CameraOff, Images } from "lucide-react";
import clsx from "clsx";
import SnapReviewScreen from "@/components/snap/SnapReviewScreen";
import MemoriesScreen from "@/components/snap/MemoriesScreen";

type NamedFilter = FilterSettings & { id: string; name: string };
type Step = "camera" | "review" | "memories";

export default function SnapPage() {
  // useSearchParams needs a Suspense boundary at build time — see AGENTS.md.
  return (
    <Suspense fallback={null}>
      <SnapPageInner />
    </Suspense>
  );
}

function SnapPageInner() {
  const searchParams = useSearchParams();
  const forStory = searchParams.get("for") === "story";

  const creatorFilters = useSnapStore((s) => s.filters);

  const allFilters: NamedFilter[] = [...BUILTIN_PRESETS, ...creatorFilters];
  const [selectedId, setSelectedId] = useState(allFilters[0].id);
  const selected = allFilters.find((f) => f.id === selectedId) ?? allFilters[0];

  const [permission, setPermission] = useState<"pending" | "granted" | "denied">("pending");
  const [justCaptured, setJustCaptured] = useState(false);
  const [step, setStep] = useState<Step>("camera");
  const [pendingCapture, setPendingCapture] = useState<{ dataUrl: string; filterName: string } | null>(null);

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
    setJustCaptured(true);
    window.setTimeout(() => setJustCaptured(false), 250);
    setPendingCapture({ dataUrl, filterName: selected.name });
    setStep("review");
  }

  if (step === "review" && pendingCapture) {
    return (
      <SnapReviewScreen
        dataUrl={pendingCapture.dataUrl}
        filterName={pendingCapture.filterName}
        forStory={forStory}
        onClose={() => {
          setPendingCapture(null);
          setStep("camera");
        }}
      />
    );
  }

  if (step === "memories") {
    return (
      <MemoriesScreen
        onBack={() => setStep("camera")}
        onPick={(dataUrl) => {
          setPendingCapture({ dataUrl, filterName: "Camera Roll" });
          setStep("review");
        }}
      />
    );
  }

  return (
    <div className="px-5 pt-6 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-accentDark">{forStory ? "Add to your story" : "Camera"}</p>
          <h1 className="mt-1 text-2xl font-semibold text-ink">Snap</h1>
        </div>
        <button
          onClick={() => setStep("memories")}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/5 text-ink/60 hover:bg-black/10"
          title="Memories"
        >
          <Images size={19} />
        </button>
      </div>

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
        {justCaptured && <div className="pointer-events-none absolute inset-0 bg-white/80 transition-opacity" />}
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
    </div>
  );
}
