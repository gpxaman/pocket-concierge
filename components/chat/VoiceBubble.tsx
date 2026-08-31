"use client";

import { useRef, useState } from "react";
import { Play, Pause } from "lucide-react";

function formatDuration(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Compact WhatsApp-style voice note pill: play/pause + a slim progress bar + duration, backed by a hidden <audio> element. */
export default function VoiceBubble({ dataUrl, durationMs, tone }: { dataUrl: string; durationMs?: number; tone: "out" | "in" }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      void audio.play();
    }
  }

  return (
    <div className="flex w-44 items-center gap-2">
      <button
        onClick={toggle}
        className={
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full " +
          (tone === "out" ? "bg-ink/15 text-ink" : "bg-black/10 text-ink")
        }
      >
        {playing ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
      </button>
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-black/10">
        <div className="h-full rounded-full bg-current opacity-60" style={{ width: `${progress * 100}%` }} />
      </div>
      <span className="shrink-0 text-[10px] tabular-nums opacity-60">{formatDuration(durationMs ?? 0)}</span>
      <audio
        ref={audioRef}
        src={dataUrl}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          if (el.duration) setProgress(el.currentTime / el.duration);
        }}
        className="hidden"
      />
    </div>
  );
}
