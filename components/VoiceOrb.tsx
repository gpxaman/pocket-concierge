"use client";

import { useEffect, useRef } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { Mic, MicOff, Loader2, Volume2 } from "lucide-react";
import clsx from "clsx";

export type OrbPhase = "idle" | "listening" | "thinking" | "speaking" | "denied";

/**
 * The ChatGPT-style voice orb: layered blurred "cloud" blobs instead of a
 * flat disc. Reactivity is honest about what browser APIs can actually do —
 * genuinely audio-reactive while listening (a real AnalyserNode on the mic
 * stream), a lively but not audio-true pulse while speaking (browser
 * SpeechSynthesis doesn't expose its output audio, so this can't be driven
 * by real amplitude the way listening can).
 */
export default function VoiceOrb({
  big,
  phase,
  muted,
  onTap,
  micStream,
}: {
  big: boolean;
  phase: OrbPhase;
  muted: boolean;
  onTap: () => void;
  micStream?: MediaStream | null;
}) {
  const scale = useMotionValue(1);
  const smoothScale = useSpring(scale, { stiffness: 260, damping: 22 });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (phase !== "listening" || !micStream) {
      scale.set(1);
      return;
    }

    let audioCtx: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let cancelled = false;

    try {
      const AudioCtxCtor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxCtor) return;
      audioCtx = new AudioCtxCtor();
      source = audioCtx.createMediaStreamSource(micStream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        if (cancelled) return;
        analyser.getByteTimeDomainData(data);
        let sumSquares = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sumSquares += v * v;
        }
        const rms = Math.sqrt(sumSquares / data.length);
        scale.set(1 + Math.min(rms * 3.5, 0.4));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // mic visualization is a nice-to-have — if AudioContext setup fails, just skip it
    }

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      source?.disconnect();
      void audioCtx?.close().catch(() => {});
      scale.set(1);
    };
  }, [phase, micStream, scale]);

  const PhaseIcon = phase === "thinking" ? Loader2 : phase === "speaking" ? Volume2 : muted ? MicOff : Mic;
  const size = big ? "h-32 w-32" : "h-11 w-11";

  return (
    <div className={clsx("relative flex shrink-0 items-center justify-center", big ? "h-52 w-52" : "h-11 w-11")}>
      {phase === "listening" &&
        big &&
        [0, 1, 2].map((i) => (
          <span key={i} className="voice-ring absolute inset-0 rounded-full" style={{ animationDelay: `${i * 0.6}s` }} />
        ))}

      <motion.button
        onClick={onTap}
        style={{ scale: phase === "listening" ? smoothScale : 1 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={clsx("relative flex items-center justify-center rounded-full", size)}
      >
        {/* layered blurred cloud blobs */}
        <span
          className={clsx(
            "absolute inset-0 rounded-full bg-gradient-to-br from-accent via-[#ffe27a] to-[#c98f00] blur-lg",
            phase === "idle" && "voice-orb-idle cloud-layer-1",
            phase === "speaking" && "cloud-speaking"
          )}
        />
        <span
          className={clsx(
            "absolute inset-[10%] rounded-full bg-gradient-to-tr from-[#ffe27a] via-accent to-[#c98f00] opacity-90 blur-md cloud-layer-2"
          )}
        />
        <span className="absolute inset-[22%] rounded-full bg-gradient-to-br from-accent to-[#c98f00] shadow-[0_0_40px_rgba(245,197,24,0.35)]" />
        <PhaseIcon size={big ? 30 : 16} className={clsx("relative z-10 text-ink", phase === "thinking" && "animate-spin")} />
      </motion.button>
    </div>
  );
}
