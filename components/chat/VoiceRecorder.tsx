"use client";

import { useRef, useState } from "react";
import { Mic, X } from "lucide-react";

function formatDuration(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** WhatsApp-style hold-to-record mic button: press and hold to record,
 * release to send, or tap the cancel (X) that appears while recording to
 * discard. Uses MediaRecorder + FileReader (not manual base64 chunking —
 * FileReader.readAsDataURL handles arbitrary blob sizes natively, same
 * pattern already used for Snap's Camera Roll picker). */
export default function VoiceRecorder({ onSend }: { onSend: (dataUrl: string, durationMs: number) => void }) {
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);

  function stopTick() {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }

  async function startRecording() {
    if (recorderRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      cancelledRef.current = false;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        recorderRef.current = null;
        const durationMs = Date.now() - startedAtRef.current;
        if (cancelledRef.current || chunksRef.current.length === 0) return;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") onSend(reader.result, durationMs);
        };
        reader.readAsDataURL(blob);
      };
      recorder.start();
      startedAtRef.current = Date.now();
      setElapsedMs(0);
      setRecording(true);
      tickRef.current = setInterval(() => setElapsedMs(Date.now() - startedAtRef.current), 200);
    } catch {
      // Mic permission denied or unavailable — silently no-op, same as
      // Snap's camera-denied handling elsewhere in the app.
    }
  }

  function finishRecording(cancel: boolean) {
    stopTick();
    setRecording(false);
    cancelledRef.current = cancel;
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
  }

  return (
    <div className="relative">
      {recording && (
        <div className="absolute bottom-full right-0 mb-2 flex items-center gap-2 rounded-full bg-ink px-3 py-1.5 text-white shadow-lg">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
          <span className="text-xs font-medium tabular-nums">{formatDuration(elapsedMs)}</span>
          <button
            onClick={() => finishRecording(true)}
            className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
            title="Cancel"
          >
            <X size={11} />
          </button>
        </div>
      )}
      <button
        onPointerDown={(e) => {
          e.preventDefault();
          void startRecording();
        }}
        onPointerUp={() => finishRecording(false)}
        onPointerLeave={() => recording && finishRecording(true)}
        className={
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition active:scale-95 " +
          (recording ? "bg-red-500 text-white" : "bg-accent text-ink")
        }
        title="Hold to record a voice note"
      >
        <Mic size={18} />
      </button>
    </div>
  );
}
