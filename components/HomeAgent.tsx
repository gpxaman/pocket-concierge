"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Loader2, Volume2, Keyboard, Send, RotateCcw, ShoppingBag, Sparkles } from "lucide-react";
import clsx from "clsx";
import { useAppStore } from "@/lib/store/useAppStore";
import { ChatMessage } from "@/lib/types";
import { findById } from "@/lib/data/catalog";
import ItemCard from "@/components/ItemCard";

type Phase = "idle" | "listening" | "thinking" | "speaking" | "denied";

const QUICK_ACTIONS = [
  { label: "Order pizza", prompt: "I want to eat pizza, order it for me." },
  { label: "Laptop for college", prompt: "I need a laptop for college, coding and some editing. Budget around 80,000." },
  { label: "Book a hotel", prompt: "Book a hotel for this weekend, something with free cancellation." },
  { label: "Get a ride", prompt: "Get me a ride." },
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function renderInline(text: string) {
  const normalized = text.replace(/^\s*\*(?!\*)\s+/gm, "• ");
  const parts = normalized.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

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

function OrbButton({
  big,
  phase,
  muted,
  onTap,
}: {
  big: boolean;
  phase: Phase;
  muted: boolean;
  onTap: () => void;
}) {
  const PhaseIcon = phase === "thinking" ? Loader2 : phase === "speaking" ? Volume2 : muted ? MicOff : Mic;
  return (
    <div className={clsx("relative flex shrink-0 items-center justify-center", big ? "h-48 w-48" : "h-11 w-11")}>
      {phase === "listening" &&
        big &&
        [0, 1, 2].map((i) => (
          <span key={i} className="voice-ring absolute inset-0 rounded-full" style={{ animationDelay: `${i * 0.6}s` }} />
        ))}
      <motion.button
        onClick={onTap}
        className={clsx(
          "relative flex items-center justify-center rounded-full bg-gradient-to-br from-accent via-[#ffe27a] to-[#c98f00]",
          big ? "h-32 w-32 shadow-[0_0_60px_rgba(245,197,24,0.35)]" : "h-11 w-11 shadow-[0_0_20px_rgba(245,197,24,0.3)]",
          phase === "idle" && "voice-orb-idle"
        )}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={
          phase === "listening"
            ? { scale: [1, 1.07, 1], opacity: 1 }
            : phase === "speaking"
              ? { scale: [1, 1.1, 0.98, 1.06, 1], opacity: 1 }
              : { scale: 1, opacity: 1 }
        }
        transition={{
          repeat: phase === "listening" || phase === "speaking" ? Infinity : 0,
          duration: phase === "speaking" ? 0.9 : 1.6,
          ease: "easeInOut",
        }}
      >
        <PhaseIcon size={big ? 32 : 16} className={clsx("text-ink", phase === "thinking" && "animate-spin")} />
      </motion.button>
    </div>
  );
}

export default function HomeAgent() {
  const chatMessages = useAppStore((s) => s.chatMessages);
  const addChatMessage = useAppStore((s) => s.addChatMessage);
  const clearChat = useAppStore((s) => s.clearChat);
  const logAudit = useAppStore((s) => s.logAudit);
  const displayName = useAppStore((s) => s.displayName);
  const cart = useAppStore((s) => s.cart);
  const setCart = useAppStore((s) => s.setCart);
  const walletBalance = useAppStore((s) => s.walletBalance);
  const placeOrderFromCart = useAppStore((s) => s.placeOrderFromCart);

  const [started, setStarted] = useState(chatMessages.length > 0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [caption, setCaption] = useState("");
  const [muted, setMuted] = useState(false);
  const [showTyped, setShowTyped] = useState(false);
  const [typedValue, setTypedValue] = useState("");
  const [supported, setSupported] = useState(true);
  const [loading, setLoading] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mutedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sendingRef = useRef(false);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chatMessages, loading]);

  useEffect(() => stopEverything, []);

  function stopEverything() {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }

  function startRecognition() {
    if (typeof window === "undefined") return;
    const Ctor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;

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
        void sendTurn(final.trim());
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
    const resume = () => {
      if (mutedRef.current) setPhase("idle");
      else startRecognition();
    };
    if (!canSpeak) {
      window.setTimeout(resume, 700);
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.02;
    utter.onend = resume;
    utter.onerror = resume;
    window.speechSynthesis.speak(utter);
  }

  async function sendTurn(text: string) {
    const trimmed = text.trim();
    if (!trimmed) {
      startRecognition();
      return;
    }
    if (sendingRef.current) return; // a turn is already in flight — don't race it (stale cart/wallet reads)
    sendingRef.current = true;
    setStarted(true);
    const userMsg: ChatMessage = { id: uid(), role: "user", content: trimmed, createdAt: Date.now() };
    const history = [...useAppStore.getState().chatMessages, userMsg];
    addChatMessage(userMsg);
    setPhase("thinking");
    setLoading(true);
    setCaption("");

    logAudit({
      actorType: "USER",
      action: "conversation_turn",
      resourceType: "conversation",
      policyDecision: "allowed",
      detail: trimmed.slice(0, 140),
    });

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          context: { walletBalance: useAppStore.getState().walletBalance, cart: useAppStore.getState().cart, displayName },
        }),
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
        detail: `${(data.itemIds ?? []).length} item(s) presented via ${data.mode} mode.`,
      });

      if (Array.isArray(data.cart)) setCart(data.cart);

      if (data.orderResult?.ok) {
        const commit = placeOrderFromCart("wallet", { placedBy: "AI_AGENT" });
        if (!commit.ok) {
          addChatMessage({
            id: uid(),
            role: "assistant",
            content: "Sorry — something changed and I couldn't finish placing that order. Please try again.",
            createdAt: Date.now(),
          });
        }
      }

      speak(String(data.reply).replace(/\*\*/g, ""));
    } catch {
      speak("Sorry, something went wrong reaching the concierge.");
    } finally {
      setLoading(false);
      sendingRef.current = false;
    }
  }

  function startSession() {
    setStarted(true);
    const greeting = `Hi ${displayName || "there"}, how can I help you today?`;
    addChatMessage({ id: uid(), role: "assistant", content: greeting, createdAt: Date.now() });
    speak(greeting);
  }

  function handleOrbTap() {
    if (!started) {
      startSession();
    } else if (phase === "listening") {
      recognitionRef.current?.stop();
    } else if (phase === "idle" || phase === "denied") {
      startRecognition();
    } else if (phase === "speaking") {
      window.speechSynthesis?.cancel();
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
      } else if (started && phase === "idle") {
        startRecognition();
      }
      return next;
    });
  }

  function resetConversation() {
    stopEverything();
    clearChat();
    setStarted(false);
    setPhase("idle");
    setCaption("");
    setShowTyped(false);
  }

  const cartTotal = cart.reduce((sum, c) => sum + (findById(c.itemId)?.price ?? 0) * c.qty, 0);
  const cartCount = cart.reduce((n, c) => n + c.qty, 0);

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
              : "Tap the orb to talk";

  return (
    <div className="relative flex h-[calc(100vh-5rem)] flex-col overflow-hidden bg-gradient-to-b from-[#171106] via-[#0e0a03] to-black">
      <div className="orb orb-a h-40 w-40 bg-accent" style={{ top: "-3rem", left: "-2rem" }} />
      <div className="orb orb-b h-32 w-32 bg-[#ffe27a]" style={{ top: "1rem", right: "-2.5rem" }} />
      <div className="orb orb-c h-28 w-28 bg-white" style={{ bottom: "-2.5rem", left: "40%" }} />

      {started && (
        <div className="relative z-10 flex items-center justify-between px-4 pt-4">
          <OrbButton big={false} phase={phase} muted={muted} onTap={handleOrbTap} />
          <p className="flex-1 truncate px-3 text-center text-xs text-white/45">{hint}</p>
          <button
            onClick={resetConversation}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20"
            title="Start over"
          >
            <RotateCcw size={15} />
          </button>
        </div>
      )}

      {!started ? (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-7 px-8">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium tracking-wide text-white/80 backdrop-blur"
          >
            <Sparkles size={12} className="text-accent" />
            POCKET CONCIERGE
          </motion.div>

          <OrbButton big phase={phase} muted={muted} onTap={handleOrbTap} />

          <div className="text-center">
            <p className="text-lg font-medium text-white">
              {displayName ? `Hi ${displayName}, ` : "Hi, "}
              <span className="shimmer-text">tap to talk to your concierge</span>
            </p>
            <p className="mt-1.5 text-xs text-white/40">
              I can find things, compare options, and place the order once you say go.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {QUICK_ACTIONS.map((q) => (
              <button
                key={q.label}
                onClick={() => void sendTurn(q.prompt)}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/70 transition hover:border-accent/50 hover:text-white"
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div ref={scrollRef} className="relative z-10 flex-1 space-y-3 overflow-y-auto px-4 pb-2 pt-1">
          <AnimatePresence initial={false}>
            {chatMessages.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className={clsx("flex", m.role === "user" ? "justify-end" : "justify-start")}
              >
                <div className={clsx("max-w-[85%] space-y-2", m.role === "user" ? "items-end" : "items-start")}>
                  <div
                    data-role={m.role}
                    className={clsx(
                      "whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                      m.role === "user" ? "bg-accent text-ink" : "bg-white/10 text-white/90"
                    )}
                  >
                    {renderInline(m.content)}
                  </div>
                  {m.role === "assistant" && m.mode === "fallback" && (
                    <p className="px-1 text-[10px] text-white/30">
                      Demo mode — no AI provider reachable right now (check your API keys / provider quota).
                    </p>
                  )}
                  {m.itemIds && m.itemIds.length > 0 && (
                    <div className="space-y-2">
                      {m.itemIds.map((id, i) => {
                        const item = findById(id);
                        return item ? (
                          <motion.div
                            key={id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.25, delay: 0.08 * i }}
                          >
                            <ItemCard item={item} mode="cart" />
                          </motion.div>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {loading && (
            <div className="flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2.5 text-xs text-white/40 w-fit">
              <span className="flex gap-0.5">
                <span className="bounce-dot" style={{ animationDelay: "0ms" }}>●</span>
                <span className="bounce-dot" style={{ animationDelay: "150ms" }}>●</span>
                <span className="bounce-dot" style={{ animationDelay: "300ms" }}>●</span>
              </span>
            </div>
          )}
        </div>
      )}

      {started && cartCount > 0 && (
        <div className="relative z-10 mx-4 mb-2 flex items-center justify-between rounded-full bg-white/10 px-4 py-2 text-xs text-white/70">
          <span className="inline-flex items-center gap-1.5">
            <ShoppingBag size={13} /> {cartCount} item{cartCount > 1 ? "s" : ""} in cart
          </span>
          <span className="font-semibold text-white">₹{cartTotal.toLocaleString("en-IN")}</span>
        </div>
      )}

      {phase === "listening" && caption && (
        <div className="relative z-10 px-8 pb-1 text-center text-sm text-white/70">{caption}</div>
      )}

      {showTyped && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = typedValue.trim();
            if (!v) return;
            setTypedValue("");
            void sendTurn(v);
          }}
          className="relative z-10 mx-4 mb-3 flex items-center gap-2 rounded-full bg-white/10 px-3 py-2"
        >
          <input
            autoFocus
            value={typedValue}
            onChange={(e) => setTypedValue(e.target.value)}
            placeholder="Type instead…"
            disabled={loading}
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40 disabled:opacity-40"
          />
          <button
            type="submit"
            disabled={loading || !typedValue.trim()}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-ink disabled:opacity-40"
          >
            <Send size={13} />
          </button>
        </form>
      )}

      <div className="relative z-10 flex items-center justify-center gap-4 pb-5 pt-1">
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
      </div>
    </div>
  );
}
