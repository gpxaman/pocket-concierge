"use client";

import { useEffect, useRef } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import clsx from "clsx";

export type OrbPhase = "idle" | "listening" | "processing" | "speaking" | "interrupted" | "error" | "denied";

/**
 * The real ChatGPT-voice-mode orb: a crisp circle with a soft, hazy cloud
 * texture CONTAINED inside it — no icon, no glow bleeding past the edge.
 * The previous version blurred its cloud layers without clipping them,
 * which let the haze spill outside the circle instead of reading as
 * "cloud inside a clean orb." Fixed by wrapping the layers in their own
 * `overflow-hidden rounded-full` boundary.
 *
 * Reactivity is honest about what browser APIs can actually do — genuinely
 * audio-reactive while listening (a real AnalyserNode on the mic stream).
 * Speaking can't be driven by real amplitude the same way (browser
 * SpeechSynthesis doesn't expose its output audio) so it's driven instead by
 * `utter.onboundary` events bumping a decaying energy value each frame —
 * same rAF-loop shape as listening, just fed by word/sentence boundaries
 * instead of mic RMS.
 */
export default function VoiceOrb({
  big,
  phase,
  muted,
  onTap,
  micStream,
  speakEnergyToken,
  errorFlavor,
}: {
  big: boolean;
  phase: OrbPhase;
  muted: boolean;
  onTap: () => void;
  micStream?: MediaStream | null;
  /** Bumped (any change, including repeats) on each TTS word/sentence boundary — drives the speaking-phase kick. */
  speakEnergyToken?: number;
  /** Layers the error tint under whatever's currently rendering (e.g. a spoken apology) without a separate phase/delay. */
  errorFlavor?: boolean;
}) {
  const scale = useMotionValue(1);
  const smoothScale = useSpring(scale, { stiffness: 260, damping: 22 });
  const rafRef = useRef<number | null>(null);

  // Listening — real mic amplitude via AnalyserNode, lightly smoothed (EMA)
  // to avoid frame-to-frame jitter from raw RMS.
  useEffect(() => {
    if (phase !== "listening" || !micStream) {
      scale.set(1);
      return;
    }

    let audioCtx: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let cancelled = false;
    let emaRms = 0;

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
        emaRms = emaRms * 0.7 + rms * 0.3;
        scale.set(1 + Math.min(emaRms * 3.5, 0.4));
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

  // Speaking — no real output-audio access, so react to word/sentence
  // boundary events instead: each token bump gives `energy` a (slightly
  // randomized) kick, which decays every frame — continuous and organic
  // rather than a hard per-word snap, and never needs a per-word timer.
  const speakRafRef = useRef<number | null>(null);
  const energyRef = useRef(0);
  const lastTokenRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (phase !== "speaking") {
      scale.set(1);
      return;
    }
    let cancelled = false;
    energyRef.current = 0;
    lastTokenRef.current = speakEnergyToken;

    const tick = () => {
      if (cancelled) return;
      energyRef.current *= 0.88;
      scale.set(1 + Math.min(energyRef.current, 0.32));
      speakRafRef.current = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelled = true;
      if (speakRafRef.current) cancelAnimationFrame(speakRafRef.current);
      scale.set(1);
    };
  }, [phase, scale]);

  useEffect(() => {
    if (phase !== "speaking" || speakEnergyToken === undefined) return;
    if (speakEnergyToken === lastTokenRef.current) return;
    lastTokenRef.current = speakEnergyToken;
    energyRef.current = Math.min(energyRef.current + 0.16 + Math.random() * 0.1, 0.32);
  }, [phase, speakEnergyToken]);

  const size = big ? "h-32 w-32" : "h-11 w-11";
  const reactive = phase === "listening" || phase === "speaking";

  return (
    <div className={clsx("relative flex shrink-0 items-center justify-center", big ? "h-52 w-52" : "h-11 w-11")}>
      {phase === "listening" &&
        big &&
        [0, 1, 2].map((i) => (
          <span key={i} className="voice-ring absolute inset-0 rounded-full" style={{ animationDelay: `${i * 0.6}s` }} />
        ))}

      <motion.button
        onClick={onTap}
        style={{ scale: reactive ? smoothScale : 1 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={clsx(
          "relative overflow-hidden rounded-full bg-[#2a1f06] transition-[filter] duration-300",
          size,
          phase === "interrupted" && "voice-orb-interrupt",
          muted && "grayscale opacity-60"
        )}
      >
        {/* Cloud layers — clipped to the circle by the parent's overflow-hidden, so the haze reads as "inside the orb" rather than a glow bleeding past its edge. Golden/amber to match the app's own accent palette, not the reference screenshot's blue. */}
        <span
          className={clsx(
            "absolute -inset-2 bg-gradient-to-br from-white via-[#ffe27a] to-accent blur-lg",
            phase === "idle" && "voice-orb-idle cloud-layer-1",
            phase === "processing" && "voice-orb-processing",
            phase === "speaking" && "cloud-speaking"
          )}
        />
        <span className="absolute -inset-2 bg-gradient-to-tr from-[#fff4c2] via-accent to-[#c98f00] opacity-80 blur-md cloud-layer-2" />
        {(phase === "error" || errorFlavor) && <span className="voice-orb-error absolute -inset-2 bg-red-500 blur-lg" />}
      </motion.button>
    </div>
  );
}
