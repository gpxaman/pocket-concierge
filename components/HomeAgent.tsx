"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Keyboard, Send, RotateCcw, ShoppingBag, Sparkles, Paperclip, X } from "lucide-react";
import clsx from "clsx";
import { useAppStore } from "@/lib/store/useAppStore";
import { ChatMessage } from "@/lib/types";
import { findById } from "@/lib/data/catalog";
import { todayIso } from "@/lib/dates";
import ItemCard from "@/components/ItemCard";
import VoiceOrb, { OrbPhase } from "@/components/VoiceOrb";

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

interface PendingImage {
  dataUrl: string;
  mimeType: string;
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
  const bookHotel = useAppStore((s) => s.bookHotel);

  const [started, setStarted] = useState(chatMessages.length > 0);
  const [phase, setPhase] = useState<OrbPhase>("idle");
  const [caption, setCaption] = useState("");
  const [muted, setMuted] = useState(false);
  const [showTyped, setShowTyped] = useState(false);
  const [typedValue, setTypedValue] = useState("");
  const [supported, setSupported] = useState(true);
  const [loading, setLoading] = useState(false);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mutedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sendingRef = useRef(false);
  const passiveRef = useRef(false); // true while recognition is running silently for barge-in detection during AI speech
  const micStreamRef = useRef<MediaStream | null>(null);
  const pendingImageRef = useRef<PendingImage | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    pendingImageRef.current = pendingImage;
  }, [pendingImage]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chatMessages, loading]);

  useEffect(() => stopEverything, []);

  function stopEverything() {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    passiveRef.current = false;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    setMicStream(null);
  }

  // Separate from SpeechRecognition's own internal mic capture — purely so
  // the orb can react to real audio amplitude while listening. Best-effort:
  // if it fails, the orb just falls back to its non-reactive animation.
  async function ensureMicStream() {
    if (micStreamRef.current?.active) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      setMicStream(stream);
    } catch {
      // no visualization stream — the voice pipeline itself doesn't depend on this
    }
  }

  function startRecognition(passive = false) {
    if (typeof window === "undefined") return;
    const Ctor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;

    if (!Ctor) {
      setSupported(false);
      setShowTyped(true);
      if (!passive) setPhase("idle");
      return;
    }

    void ensureMicStream();

    const rec = new Ctor();
    // continuous:true so a long AI reply doesn't let the recognizer time out
    // and silently stop listening for a barge-in partway through.
    rec.continuous = true;
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
      const heardSomething = Boolean(final.trim() || interim.trim());

      // Barge-in: the user started talking while the AI was still speaking —
      // stop it immediately, like ChatGPT's voice mode, instead of finishing the sentence.
      if (passiveRef.current && heardSomething) {
        window.speechSynthesis.cancel();
        passiveRef.current = false;
        setPhase("listening");
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
      } else if (!passiveRef.current) {
        setPhase("idle");
      }
    };
    rec.onend = () => {
      recognitionRef.current = null;
      passiveRef.current = false;
    };

    recognitionRef.current = rec;
    passiveRef.current = passive;
    setCaption("");
    if (!passive) setPhase("listening");
    try {
      rec.start();
    } catch {
      // recognition already running — ignore
    }
  }

  function speak(text: string) {
    setPhase("speaking");
    setCaption(text);

    const resume = () => {
      if (mutedRef.current) {
        stopEverything();
        setPhase("idle");
        return;
      }
      if (recognitionRef.current && passiveRef.current) {
        // still running from the passive start below — just promote it, don't restart
        passiveRef.current = false;
        setPhase("listening");
      } else if (!recognitionRef.current) {
        startRecognition();
      }
      // else: already promoted mid-speech via barge-in — nothing to do
    };

    const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;
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

    // Start listening in the background immediately so talking over the
    // reply interrupts it, instead of only listening after it finishes.
    if (!mutedRef.current) startRecognition(true);
  }

  function handleImageButton() {
    fileInputRef.current?.click();
  }

  function handleImageSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setPendingImage({ dataUrl: reader.result, mimeType: file.type });
      }
    };
    reader.readAsDataURL(file);
  }

  async function sendTurn(text: string) {
    const trimmed = text.trim();
    const image = pendingImageRef.current;
    if (!trimmed && !image) {
      startRecognition();
      return;
    }
    if (sendingRef.current) return; // a turn is already in flight — don't race it (stale cart/wallet reads)
    sendingRef.current = true;
    setStarted(true);
    const userMsg: ChatMessage = {
      id: uid(),
      role: "user",
      content: trimmed || "(sent an image)",
      createdAt: Date.now(),
      imageDataUrl: image?.dataUrl,
    };
    const history = [...useAppStore.getState().chatMessages, userMsg];
    addChatMessage(userMsg);
    setPendingImage(null);
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
          context: {
            walletBalance: useAppStore.getState().walletBalance,
            cart: useAppStore.getState().cart,
            displayName,
            today: todayIso(),
          },
          image: image ? { dataUrl: image.dataUrl, mimeType: image.mimeType } : undefined,
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

      if (data.hotelBooking?.ok) {
        const commit = bookHotel(
          {
            itemId: data.hotelBooking.item_id,
            checkIn: data.hotelBooking.check_in,
            checkOut: data.hotelBooking.check_out,
            guests: data.hotelBooking.guests,
            source: "wallet",
          },
          { placedBy: "AI_AGENT" }
        );
        if (!commit.ok) {
          addChatMessage({
            id: uid(),
            role: "assistant",
            content: "Sorry — something changed and I couldn't finish that booking. Please try again.",
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
      // onerror -> resume() (in speak()) promotes the still-running passive
      // recognition, or starts fresh — single code path, no duplicate start.
      window.speechSynthesis?.cancel();
    }
  }

  function toggleMute() {
    setMuted((m) => {
      const next = !m;
      if (next) {
        recognitionRef.current?.abort();
        passiveRef.current = false;
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
    setPendingImage(null);
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
    <div className="fixed inset-x-0 top-0 bottom-20 z-10 mx-auto flex max-w-md flex-col overflow-hidden bg-gradient-to-b from-[#171106] via-[#0e0a03] to-black">
      <div className="orb orb-a h-40 w-40 bg-accent" style={{ top: "-3rem", left: "-2rem" }} />
      <div className="orb orb-b h-32 w-32 bg-[#ffe27a]" style={{ top: "1rem", right: "-2.5rem" }} />
      <div className="orb orb-c h-28 w-28 bg-white" style={{ bottom: "-2.5rem", left: "40%" }} />

      {started && (
        <div className="relative z-10 flex items-center justify-between px-4 pt-4">
          <VoiceOrb big={false} phase={phase} muted={muted} onTap={handleOrbTap} micStream={micStream} />
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

          <VoiceOrb big phase={phase} muted={muted} onTap={handleOrbTap} micStream={micStream} />

          <div className="text-center">
            <p className="text-lg font-medium text-white">
              {displayName ? `Hi ${displayName}, ` : "Hi, "}
              <span className="shimmer-text">tap to talk to your concierge</span>
            </p>
            <p className="mt-1.5 text-xs text-white/40">
              I can find things, compare options, and place the order once you say go.
            </p>
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
                    {m.imageDataUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.imageDataUrl} alt="Attached" className="mb-2 max-h-40 rounded-lg object-cover" />
                    )}
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
            <div className="flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2.5 text-xs text-white/50 w-fit">
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 2.2, ease: "linear" }}
                className="text-accent"
              >
                <Sparkles size={13} />
              </motion.span>
              <span>Thinking</span>
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

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelected} />

      {pendingImage && (
        <div className="relative z-10 mx-4 mb-2 flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pendingImage.dataUrl} alt="Selected" className="h-10 w-10 rounded-lg object-cover" />
          <span className="flex-1 text-xs text-white/60">Image attached — will send with your next message</span>
          <button
            onClick={() => setPendingImage(null)}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {showTyped && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = typedValue.trim();
            if (!v && !pendingImage) return;
            setTypedValue("");
            void sendTurn(v);
          }}
          className="relative z-10 mx-4 mb-3 flex items-center gap-2 rounded-full bg-white/10 px-3 py-2"
        >
          <button
            type="button"
            onClick={handleImageButton}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/60 hover:text-white"
            title="Attach an image"
          >
            <Paperclip size={15} />
          </button>
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
            disabled={loading || (!typedValue.trim() && !pendingImage)}
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
          onClick={handleImageButton}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/20"
          title="Attach an image"
        >
          <Paperclip size={18} />
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
