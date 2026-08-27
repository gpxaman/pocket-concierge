"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mic, MicOff, Loader2, Volume2, Keyboard, Send } from "lucide-react";
import clsx from "clsx";
import { useAppStore } from "@/lib/store/useAppStore";
import { ChatMessage } from "@/lib/types";

type Phase = "idle" | "listening" | "thinking" | "speaking" | "denied";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// Minimal shape of the (non-standard) Web Speech API — not in TS's default
// DOM lib, so we declare just what we use rather than pulling in `any`.
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { isFinal: boolean; [index: number]: { transcript: string } }[];
}

export default function VoiceOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addChatMessage = useAppStore((s) => s.addChatMessage);
  const logAudit = useAppStore((s) => s.logAudit);

  const [phase, setPhase] = useState<Phase>("idle");
  const [caption, setCaption] = useState("");
  const [muted, setMuted] = useState(false);
  const [showTyped, setShowTyped] = useState(false);
  const [typedValue, setTypedValue] = useState("");
  const [supported, setSupported] = useState(true);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mutedRef = useRef(false);
  const openRef = useRef(false);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  function stopEverything() {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }

  function startRecognition() {
    if (typeof window === "undefined") return;
    const Ctor = (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike })
      .SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;

    if (!Ctor) {
      setSupported(false);
      setShowTyped(true);
      setPhase("idle");
      return;
    }

    const rec = new Ctor();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (e) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      setCaption(final || interim);
      if (final.trim()) {
        rec.stop();
        void runTurn(final.trim());
      }
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setPhase("denied");
        setShowTyped(true);
      } else {
        setPhase("idle");
      }
    };
    rec.onend = () => {
      recognitionRef.current = null;
    };

    recognitionRef.current = rec;
    setCaption("");
    setPhase("listening");
    try {
      rec.start();
    } catch {
      // recognition already running — ignore
    }
  }

  function speak(text: string) {
    setPhase("speaking");
    setCaption(text);
    const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;
    if (!canSpeak) {
      window.setTimeout(() => {
        if (!openRef.current) return;
        if (mutedRef.current) setPhase("idle");
        else startRecognition();
      }, 700);
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.02;
    const resume = () => {
      if (!openRef.current) return;
      if (mutedRef.current) setPhase("idle");
      else startRecognition();
    };
    utter.onend = resume;
    utter.onerror = resume;
    window.speechSynthesis.speak(utter);
  }

  async function runTurn(text: string) {
    const trimmed = text.trim();
    if (!trimmed) {
      startRecognition();
      return;
    }
    const userMsg: ChatMessage = { id: uid(), role: "user", content: trimmed, createdAt: Date.now() };
    const history = [...useAppStore.getState().chatMessages, userMsg];
    addChatMessage(userMsg);
    setPhase("thinking");
    setCaption("");
    logAudit({
      actorType: "USER",
      action: "voice_turn",
      resourceType: "conversation",
      policyDecision: "allowed",
      detail: trimmed.slice(0, 140),
    });

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      const data = await res.json();
      addChatMessage({
        id: uid(),
        role: "assistant",
        content: data.reply,
        itemIds: data.itemIds ?? [],
        mode: data.mode,
        createdAt: Date.now(),
      });
      logAudit({
        actorType: "AI_AGENT",
        action: "recommendation_presented",
        resourceType: "conversation",
        policyDecision: "allowed",
        detail: `${(data.itemIds ?? []).length} item(s) via voice, ${data.mode} mode.`,
      });
      speak(String(data.reply).replace(/\*\*/g, ""));
    } catch {
      speak("Sorry, something went wrong reaching the concierge.");
    }
  }

  useEffect(() => {
    if (open) {
      setPhase("idle");
      setCaption("");
      setShowTyped(false);
      setSupported(true);
      setMuted(false);
      startRecognition();
    } else {
      stopEverything();
      setPhase("idle");
    }
    return () => stopEverything();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleOrbTap() {
    if (phase === "listening") {
      recognitionRef.current?.stop();
    } else if (phase === "idle") {
      startRecognition();
    }
  }

  function toggleMute() {
    setMuted((m) => {
      const next = !m;
      if (next) {
        recognitionRef.current?.abort();
        if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
        setPhase("idle");
      } else if (phase === "idle") {
        startRecognition();
      }
      return next;
    });
  }

  const hint =
    phase === "listening"
      ? "Listening…"
      : phase === "thinking"
        ? "Thinking…"
        : phase === "speaking"
          ? ""
          : phase === "denied"
            ? "Microphone access was denied — type below instead."
            : !supported
              ? "Voice isn't supported in this browser — type below instead."
              : "Tap the circle to talk";

  const PhaseIcon = phase === "thinking" ? Loader2 : phase === "speaking" ? Volume2 : muted ? MicOff : Mic;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 mx-auto max-w-md">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="pointer-events-auto absolute inset-0 flex flex-col bg-gradient-to-b from-[#171106] via-[#0e0a03] to-black"
          >
            <div className="flex justify-end px-5 pt-5">
              <button
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20"
              >
                <X size={17} />
              </button>
            </div>

            <div className="flex flex-1 flex-col items-center justify-center gap-8 px-8">
              <div className="relative flex h-48 w-48 items-center justify-center">
                {phase === "listening" &&
                  [0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="voice-ring absolute inset-0 rounded-full"
                      style={{ animationDelay: `${i * 0.6}s` }}
                    />
                  ))}

                <motion.button
                  onClick={handleOrbTap}
                  className={clsx(
                    "relative flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-accent via-[#ffe27a] to-[#c98f00] shadow-[0_0_60px_rgba(245,197,24,0.35)]",
                    phase === "idle" && "voice-orb-idle"
                  )}
                  animate={
                    phase === "listening"
                      ? { scale: [1, 1.07, 1] }
                      : phase === "speaking"
                        ? { scale: [1, 1.1, 0.98, 1.06, 1] }
                        : { scale: 1 }
                  }
                  transition={{
                    repeat: phase === "listening" || phase === "speaking" ? Infinity : 0,
                    duration: phase === "speaking" ? 0.9 : 1.6,
                    ease: "easeInOut",
                  }}
                >
                  <PhaseIcon size={34} className={clsx("text-ink", phase === "thinking" && "animate-spin")} />
                </motion.button>
              </div>

              <div className="min-h-[4.5rem] max-w-xs text-center">
                {caption ? (
                  <p className="text-base leading-relaxed text-white">{caption}</p>
                ) : (
                  <p className="text-sm text-white/45">{hint}</p>
                )}
              </div>
            </div>

            {showTyped && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = typedValue.trim();
                  if (!v) return;
                  setTypedValue("");
                  void runTurn(v);
                }}
                className="mx-6 mb-4 flex items-center gap-2 rounded-full bg-white/10 px-3 py-2"
              >
                <input
                  autoFocus
                  value={typedValue}
                  onChange={(e) => setTypedValue(e.target.value)}
                  placeholder="Type instead…"
                  className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40"
                />
                <button type="submit" className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-ink">
                  <Send size={13} />
                </button>
              </form>
            )}

            <div className="flex items-center justify-center gap-4 pb-10">
              <button
                onClick={toggleMute}
                className={clsx(
                  "flex h-11 w-11 items-center justify-center rounded-full transition",
                  muted ? "bg-white text-ink" : "bg-white/10 text-white/80 hover:bg-white/20"
                )}
                title={muted ? "Unmute" : "Mute"}
              >
                {muted ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
              <button
                onClick={() => setShowTyped((v) => !v)}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/20"
                title="Type instead"
              >
                <Keyboard size={18} />
              </button>
              <button
                onClick={onClose}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/20"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
