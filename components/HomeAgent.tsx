"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Mic, MicOff, Keyboard, Send, RotateCcw, ShoppingBag, Sparkles, Paperclip, X, Info, Share2, SlidersHorizontal } from "lucide-react";
import clsx from "clsx";
import { useAppStore } from "@/lib/store/useAppStore";
import { AiChatSSEEvent, ChatMessage } from "@/lib/types";
import { findById } from "@/lib/data/catalog";
import { todayIso } from "@/lib/dates";
import { cutSentences } from "@/lib/home/cutSentences";
import { shareOrCopyText } from "@/lib/shareOrCopy";
import { readImageFile } from "@/lib/imagePicker";
import Transcript from "@/components/home/Transcript";
import VoicePickerSheet from "@/components/home/VoicePickerSheet";
import VoiceOrb, { OrbPhase } from "@/components/VoiceOrb";

function uid() {
  return Math.random().toString(36).slice(2, 10);
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

const SILENCE_MS = 700; // how long to wait after the last result before treating a turn as finished
const NO_SPEECH_TIMEOUT_MS = 15_000; // give up and return to idle if nothing at all is heard
const INTERRUPTED_FLASH_MS = 200; // matches the CSS .voice-orb-interrupt animation duration

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
  const personalizationEnabled = useAppStore((s) => s.personalizationEnabled);
  const memory = useAppStore((s) => s.memory);

  const [started, setStarted] = useState(chatMessages.length > 0);
  const [phase, setPhase] = useState<OrbPhase>("idle");
  const [errorFlavor, setErrorFlavor] = useState(false);
  const [caption, setCaption] = useState("");
  const [muted, setMuted] = useState(false);
  const [showTyped, setShowTyped] = useState(false);
  const [typedValue, setTypedValue] = useState("");
  const [supported, setSupported] = useState(true);
  const [loading, setLoading] = useState(false);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [speakEnergyToken, setSpeakEnergyToken] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mutedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sendingRef = useRef(false);
  const micStreamRef = useRef<MediaStream | null>(null);
  const pendingImageRef = useRef<PendingImage | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Session-local closure set fresh by whichever startRecognition() call is
  // currently live — always called through this ref so callers elsewhere in
  // the file (handleOrbTap) never act on a stale session, the same
  // "re-check live state, don't trust the closure" pattern used in the
  // rides feature's ride-tracking effect.
  const finalizeNowRef = useRef<(() => void) | null>(null);

  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interruptedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noSpeechTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Speculative-streaming reply state (see sendTurn/handleStreamEvent).
  const streamAbortRef = useRef<AbortController | null>(null);
  const speechQueueRef = useRef<string[]>([]);
  const queueActiveRef = useRef(false); // this turn's queue is the thing currently allowed to speak
  const queuePlayingRef = useRef(false); // an utterance from the queue is in flight right now
  const streamDoneRef = useRef(false); // the server's terminal `done` event has arrived

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

  // Voice list loads asynchronously in most browsers (empty on first call),
  // so listen for onvoiceschanged too, not just call it once. The chosen
  // voice persists across sessions in localStorage — no need for a full
  // store field for a browser-local preference like this.
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    setSelectedVoiceURI(window.localStorage.getItem("pc-voice-uri"));
    const loadVoices = () => setVoices(window.speechSynthesis.getVoices());
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, []);

  function chooseVoice(uri: string | null) {
    setSelectedVoiceURI(uri);
    if (typeof window !== "undefined") {
      if (uri) window.localStorage.setItem("pc-voice-uri", uri);
      else window.localStorage.removeItem("pc-voice-uri");
    }
  }

  function applyVoice(utter: SpeechSynthesisUtterance) {
    const voice = selectedVoiceURI ? voices.find((v) => v.voiceURI === selectedVoiceURI) : undefined;
    if (voice) utter.voice = voice;
  }

  /** A standalone preview, deliberately outside the conversation's speak()/queue machinery — just a quick sample, not a real turn. */
  function previewVoice(voice: SpeechSynthesisVoice) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance("Hi, this is how I sound.");
    utter.voice = voice;
    utter.rate = 1.02;
    window.speechSynthesis.speak(utter);
  }

  async function handleShareTranscript() {
    const text = chatMessages.map((m) => `${m.role === "user" ? "You" : "Concierge"}: ${m.content}`).join("\n");
    await shareOrCopyText(text, {
      title: "Pocket Concierge conversation",
      onCopied: () => {
        setShareCopied(true);
        window.setTimeout(() => setShareCopied(false), 2000);
      },
    });
  }

  function clearVoiceTimers() {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (interruptedTimerRef.current) {
      clearTimeout(interruptedTimerRef.current);
      interruptedTimerRef.current = null;
    }
    if (noSpeechTimerRef.current) {
      clearTimeout(noSpeechTimerRef.current);
      noSpeechTimerRef.current = null;
    }
  }

  // The one place phase actually changes — wraps setPhase so the
  // "interrupted" flash always gets a real, guarded auto-advance instead of
  // leaving a stray timeout that could later clobber whatever phase
  // something else legitimately set in the meantime.
  function transitionPhase(next: OrbPhase) {
    if (interruptedTimerRef.current) {
      clearTimeout(interruptedTimerRef.current);
      interruptedTimerRef.current = null;
    }
    setPhase(next);
    if (next === "interrupted") {
      interruptedTimerRef.current = setTimeout(() => {
        interruptedTimerRef.current = null;
        setPhase("listening");
      }, INTERRUPTED_FLASH_MS);
    }
  }

  function stopEverything() {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    // Close the queue gate BEFORE cancelling — cancel()'s onerror can fire
    // synchronously and the queue runner's onerror only stops advancing
    // when it sees queueActiveRef already false (see runQueue).
    queueActiveRef.current = false;
    queuePlayingRef.current = false;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    setMicStream(null);
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    clearVoiceTimers();
  }

  // Separate from SpeechRecognition's own internal mic capture — purely so
  // the orb can react to real audio amplitude while listening. Best-effort:
  // if it fails, the orb just falls back to its non-reactive animation.
  // These constraints only affect THIS stream — SpeechRecognition's own
  // internal capture is opaque to JS and can't be given them; that's a real
  // Web Speech API ceiling, not a bug (see the plan's echo-mitigation note).
  async function ensureMicStream() {
    if (micStreamRef.current?.active) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      micStreamRef.current = stream;
      setMicStream(stream);
    } catch {
      // no visualization stream — the voice pipeline itself doesn't depend on this
    }
  }

  function resumeAfterSpeaking() {
    if (mutedRef.current) {
      stopEverything();
      transitionPhase("idle");
      return;
    }
    // The mic is never left running while the AI is speaking (see the big
    // comment in speak() about self-hearing), so there's never an existing
    // session to promote here — always a fresh, clean listen.
    startRecognition();
  }

  function startRecognition() {
    if (typeof window === "undefined") return;
    const Ctor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;

    if (!Ctor) {
      setSupported(false);
      setShowTyped(true);
      transitionPhase("idle");
      return;
    }

    void ensureMicStream();

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    // Local to this call — a stale timer/callback from an old session can
    // never act on the wrong recognizer, by construction, since a fresh
    // startRecognition() call always gets its own fresh locals.
    let finalTranscript = "";
    let lastInterim = "";

    function armNoSpeechTimeout() {
      if (noSpeechTimerRef.current) clearTimeout(noSpeechTimerRef.current);
      noSpeechTimerRef.current = setTimeout(() => {
        if (recognitionRef.current !== rec) return;
        if (finalTranscript.trim() || lastInterim.trim()) return; // something was said, not truly silent
        rec.stop();
      }, NO_SPEECH_TIMEOUT_MS);
    }

    function scheduleSilenceFinalize() {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(finalizeAndSend, SILENCE_MS);
    }

    function finalizeAndSend() {
      if (recognitionRef.current !== rec) return; // this session is no longer live
      silenceTimerRef.current = null;
      const text = (finalTranscript || lastInterim).trim();
      if (text) {
        rec.stop();
        void sendTurn(text);
      }
    }
    finalizeNowRef.current = finalizeAndSend;

    rec.onresult = (e) => {
      let interim = "";
      let finalChunk = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalChunk += r[0].transcript;
        else interim += r[0].transcript;
      }
      lastInterim = interim;
      if (finalChunk.trim()) finalTranscript += (finalTranscript ? " " : "") + finalChunk.trim();

      setCaption(finalTranscript || interim);
      armNoSpeechTimeout();
      scheduleSilenceFinalize();
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        transitionPhase("denied");
        setShowTyped(true);
      } else {
        transitionPhase("idle");
      }
      if (recognitionRef.current === rec) clearVoiceTimers();
    };
    rec.onend = () => {
      if (recognitionRef.current === rec) {
        recognitionRef.current = null;
        clearVoiceTimers();
      }
    };

    recognitionRef.current = rec;
    setCaption("");
    transitionPhase("listening");
    armNoSpeechTimeout();
    try {
      rec.start();
    } catch {
      // recognition already running — ignore
    }
  }

  /** Single-utterance TTS — the greeting, and any authoritative (non-speculative) reply. */
  function speak(text: string, opts?: { errorFlavor?: boolean }) {
    setErrorFlavor(Boolean(opts?.errorFlavor));
    transitionPhase("speaking");
    setCaption(text);
    setSpeakEnergyToken((t) => t + 1);

    const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;
    if (!canSpeak) {
      if (opts?.errorFlavor) {
        // No TTS AND the thing we wanted to say was an apology — genuinely
        // stuck, not just "briefly speaking an error," so this really is
        // the terminal error phase rather than a same-frame tint.
        transitionPhase("error");
        return;
      }
      window.setTimeout(resumeAfterSpeaking, 700);
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.02;
    applyVoice(utter);
    utter.onboundary = () => setSpeakEnergyToken((t) => t + 1);
    utter.onend = () => {
      setErrorFlavor(false);
      resumeAfterSpeaking();
    };
    utter.onerror = () => {
      setErrorFlavor(false);
      resumeAfterSpeaking();
    };
    // Deliberately NOT listening while this plays: the mic and the speaker
    // are the same physical hardware, and without real acoustic echo
    // cancellation (a genuine Web Speech API ceiling — see ensureMicStream's
    // comment) the recognizer would hear the AI's own voice and transcribe
    // it as a new user turn, which then gets a new reply, which gets heard
    // again — a self-sustaining loop that also starves out anything the
    // user actually says. Interruption is tap-only (see handleOrbTap);
    // listening always starts fresh only once speech has genuinely stopped.
    window.speechSynthesis.speak(utter);
  }

  /** Runs the sentence queue for a speculatively-streamed reply — chained utterance playback, gated on queueActiveRef. */
  function runQueue() {
    if (!queueActiveRef.current || queuePlayingRef.current) return;
    const next = speechQueueRef.current.shift();
    if (!next) return; // caught up — wait for more deltas or `done`
    queuePlayingRef.current = true;
    const utter = new SpeechSynthesisUtterance(next);
    utter.rate = 1.02;
    applyVoice(utter);
    utter.onboundary = () => setSpeakEnergyToken((t) => t + 1);
    const advance = () => {
      queuePlayingRef.current = false;
      if (!queueActiveRef.current) return; // retracted/barged-in — commit logic already handled the transition
      if (speechQueueRef.current.length > 0) {
        runQueue();
      } else if (streamDoneRef.current) {
        queueActiveRef.current = false;
        resumeAfterSpeaking();
      }
      // else: caught up but the stream isn't done yet — the next speech_delta/done will call runQueue again
    };
    utter.onend = advance;
    // speechSynthesis.cancel() (barge-in) fires onerror, not onend — if a
    // barge-in already flipped queueActiveRef false, do nothing here (its
    // own commit logic owns the transition); otherwise treat it like onend.
    utter.onerror = () => {
      if (queueActiveRef.current) advance();
      else queuePlayingRef.current = false;
    };
    window.speechSynthesis.speak(utter);
  }

  function beginStreamingSpeech() {
    queueActiveRef.current = true;
    transitionPhase("speaking");
    setErrorFlavor(false);
    setLoading(false);
    // Same reasoning as speak() — no passive listening during playback, to
    // avoid the mic hearing the speaker and looping on itself.
  }

  function handleImageButton() {
    fileInputRef.current?.click();
  }

  async function handleImageSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = await readImageFile(e);
    if (picked) setPendingImage(picked);
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
    transitionPhase("processing");
    setLoading(true);
    setCaption("");

    logAudit({
      actorType: "USER",
      action: "conversation_turn",
      resourceType: "conversation",
      policyDecision: "allowed",
      detail: trimmed.slice(0, 140),
    });

    streamAbortRef.current?.abort();
    const controller = new AbortController();
    streamAbortRef.current = controller;
    queueActiveRef.current = false;
    queuePlayingRef.current = false;
    streamDoneRef.current = false;
    speechQueueRef.current = [];
    let sentenceBuffer = "";
    let streamingStarted = false;

    function pushDeltaText(delta: string) {
      sentenceBuffer += delta;
      const { sentences, rest } = cutSentences(sentenceBuffer);
      sentenceBuffer = rest;
      if (sentences.length === 0) return;
      if (!streamingStarted) {
        streamingStarted = true;
        beginStreamingSpeech();
      }
      speechQueueRef.current.push(...sentences);
      setCaption((c) => (c ? `${c} ${sentences.join(" ")}` : sentences.join(" ")));
      runQueue();
    }

    function handleRetract() {
      queueActiveRef.current = false;
      queuePlayingRef.current = false;
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
      speechQueueRef.current = [];
      sentenceBuffer = "";
      streamingStarted = false;
      setCaption("");
      transitionPhase("processing");
      setLoading(true);
    }

    function handleDone(evt: Extract<AiChatSSEEvent, { type: "done" }>) {
      streamDoneRef.current = true;
      const leftover = sentenceBuffer.trim();
      sentenceBuffer = "";
      if (leftover) {
        if (!streamingStarted) {
          streamingStarted = true;
          beginStreamingSpeech();
        }
        speechQueueRef.current.push(leftover);
        setCaption((c) => (c ? `${c} ${leftover}` : leftover));
      }

      addChatMessage({
        id: uid(),
        role: "assistant",
        content: evt.reply,
        itemIds: evt.itemIds ?? [],
        mode: evt.mode as ChatMessage["mode"],
        createdAt: Date.now(),
      });
      logAudit({
        actorType: "AI_AGENT",
        action: "recommendation_presented",
        resourceType: "conversation",
        policyDecision: "allowed",
        detail: `${(evt.itemIds ?? []).length} item(s) presented via ${evt.mode} mode.`,
      });

      if (Array.isArray(evt.cart)) setCart(evt.cart);

      if (evt.orderResult?.ok) {
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

      if (evt.hotelBooking?.ok) {
        const hb = evt.hotelBooking as { item_id: string; check_in: string; check_out: string; guests: number };
        const commit = bookHotel(
          { itemId: hb.item_id, checkIn: hb.check_in, checkOut: hb.check_out, guests: hb.guests, source: "wallet" },
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

      if (evt.spoken) {
        // Already fully spoken (or about to finish being spoken) live via
        // the sentence queue. If anything is still queued/playing, the
        // queue's own advance() will see streamDoneRef=true and finish
        // naturally when it ends — but if the queue had already drained
        // completely BEFORE this `done` arrived (a short reply that
        // finished speaking faster than the network stream closed),
        // advance() already ran without knowing more wasn't coming, so
        // nothing would ever resume listening unless we finish it here.
        if (leftover) runQueue();
        if (speechQueueRef.current.length === 0 && !queuePlayingRef.current) {
          queueActiveRef.current = false;
          resumeAfterSpeaking();
        }
      } else {
        // Authoritative, fully-verified text — always spoken fresh, exactly
        // like the pre-streaming behavior (OpenRouter/fallback/any turn
        // that touched an order/booking/cart tool land here).
        speak(evt.reply.replace(/\*\*/g, ""));
      }
    }

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
        signal: controller.signal,
      });
      if (!res.body) throw new Error("empty response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const chunks = buf.split("\n\n");
        buf = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const dataLine = chunk.split("\n").find((l) => l.startsWith("data:"));
          if (!dataLine) continue;
          let evt: AiChatSSEEvent;
          try {
            evt = JSON.parse(dataLine.slice(5).trim()) as AiChatSSEEvent;
          } catch {
            continue; // malformed chunk — skip
          }
          if (evt.type === "speech_delta") pushDeltaText(evt.text);
          else if (evt.type === "retract") handleRetract();
          else if (evt.type === "done") handleDone(evt);
        }
      }
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") {
        // Barge-in already aborted this turn and handled the phase/queue
        // transition itself — nothing more to do here.
      } else {
        speak("Sorry, something went wrong reaching the concierge.", { errorFlavor: true });
      }
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
      finalizeNowRef.current?.();
    } else if (phase === "idle" || phase === "denied" || phase === "error") {
      startRecognition();
    } else if (phase === "speaking" || phase === "interrupted") {
      // Only interruption path now (no voice barge-in) — cancelling here
      // fires the utterance's onerror -> resumeAfterSpeaking(), which starts
      // a fresh listening session once speech has actually stopped.
      queueActiveRef.current = false;
      queuePlayingRef.current = false;
      streamAbortRef.current?.abort();
      transitionPhase("interrupted");
      window.speechSynthesis?.cancel();
    }
  }

  function toggleMute() {
    setMuted((m) => {
      const next = !m;
      if (next) {
        recognitionRef.current?.abort();
        queueActiveRef.current = false;
        queuePlayingRef.current = false;
        streamAbortRef.current?.abort();
        if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
        clearVoiceTimers();
        transitionPhase("idle");
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
    transitionPhase("idle");
    setCaption("");
    setShowTyped(false);
    setPendingImage(null);
  }

  const cartTotal = cart.reduce((sum, c) => sum + (findById(c.itemId)?.price ?? 0) * c.qty, 0);
  const cartCount = cart.reduce((n, c) => n + c.qty, 0);

  const hint =
    phase === "listening"
      ? "Listening…"
      : phase === "processing"
        ? "Thinking…"
        : phase === "interrupted"
          ? "Go ahead…"
          : phase === "speaking"
            ? ""
            : phase === "error"
              ? "Something went wrong — tap to try again."
              : phase === "denied"
                ? "Microphone access was denied — type below instead."
                : !supported
                  ? "Voice isn't supported in this browser — type below instead."
                  : "Tap the orb to talk";

  return (
    <>
    <div className="fixed inset-x-0 top-0 bottom-20 z-10 mx-auto flex max-w-md flex-col overflow-hidden bg-gradient-to-b from-[#171106] via-[#0e0a03] to-black">
      <div className="orb orb-a h-40 w-40 bg-accent" style={{ top: "-3rem", left: "-2rem" }} />
      <div className="orb orb-b h-32 w-32 bg-[#ffe27a]" style={{ top: "1rem", right: "-2.5rem" }} />
      <div className="orb orb-c h-28 w-28 bg-white" style={{ bottom: "-2.5rem", left: "40%" }} />

      {started && (
        <div className="relative z-10 flex items-center justify-between px-4 pt-4">
          <p className="flex-1 truncate pr-2 text-xs text-white/45">{hint}</p>
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => setShowInfo(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:bg-white/10"
              title="Info"
            >
              <Info size={17} />
            </button>
            <button
              onClick={handleShareTranscript}
              className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:bg-white/10"
              title="Share"
            >
              <Share2 size={17} />
            </button>
            <button
              onClick={() => setShowVoicePicker(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:bg-white/10"
              title="Change voice"
            >
              <SlidersHorizontal size={17} />
            </button>
          </div>
        </div>
      )}

      {/* The orb is always the dominant visual element — before starting it
          fills the whole available space (centered, like ChatGPT's own
          voice-mode screen); once a conversation is running it shrinks to a
          persistent "hero" strip above the scrolling transcript, so it never
          disappears from view the way a header-only mini orb would. */}
      <div className={clsx("relative z-10 flex flex-col items-center justify-center gap-4 px-8", !started ? "flex-1" : "shrink-0 pb-2 pt-1")}>
        {!started && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium tracking-wide text-white/80 backdrop-blur"
          >
            <Sparkles size={12} className="text-accent" />
            POCKET CONCIERGE
          </motion.div>
        )}

        <VoiceOrb
          big={!started}
          phase={phase}
          muted={muted}
          onTap={handleOrbTap}
          micStream={micStream}
          speakEnergyToken={speakEnergyToken}
          errorFlavor={errorFlavor}
        />

        {!started && (
          <div className="text-center">
            <p className="text-lg font-medium text-white">
              {displayName ? `Hi ${displayName}, ` : "Hi, "}
              <span className="shimmer-text">tap to talk to your concierge</span>
            </p>
            <p className="mt-1.5 text-xs text-white/40">
              I can find things, compare options, and place the order once you say go.
            </p>
          </div>
        )}
      </div>

      {started && <Transcript scrollRef={scrollRef} chatMessages={chatMessages} loading={loading} />}

      {started && cartCount > 0 && (
        <div className="relative z-10 mx-4 mb-2 flex items-center justify-between rounded-full bg-white/10 px-4 py-2 text-xs text-white/70">
          <span className="inline-flex items-center gap-1.5">
            <ShoppingBag size={13} /> {cartCount} item{cartCount > 1 ? "s" : ""} in cart
          </span>
          <span className="font-semibold text-white">₹{cartTotal.toLocaleString("en-IN")}</span>
        </div>
      )}

      {/* Only shown while listening — it's useful live feedback for what
          you're saying, but the AI's own reply already appears in the
          transcript above, so repeating it as a caption while it speaks
          is just noise. */}
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

    {showInfo && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/60" onClick={() => setShowInfo(false)}>
          <div className="mx-auto w-full max-w-md rounded-t-2xl bg-[#171106] p-5 pb-8 text-white" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-semibold">About this conversation</p>
            <div className="mt-3 space-y-2 text-xs text-white/60">
              <p>Personalization: {personalizationEnabled ? "On" : "Off"}</p>
              <p>Remembered facts: {memory.length}</p>
              <p>Messages this session: {chatMessages.length}</p>
              {!supported && <p className="text-amber-300/80">Voice input isn&apos;t supported in this browser — use the keyboard.</p>}
            </div>
            <button
              onClick={() => {
                resetConversation();
                setShowInfo(false);
              }}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-white/10 py-2.5 text-sm font-medium text-white/85 hover:bg-white/15"
            >
              <RotateCcw size={14} /> Start over
            </button>
            <button onClick={() => setShowInfo(false)} className="mt-2 flex w-full items-center justify-center py-2 text-xs text-white/40">
              Close
            </button>
          </div>
        </div>
      )}

      {showVoicePicker && (
        <VoicePickerSheet
          voices={voices}
          selectedVoiceURI={selectedVoiceURI}
          onChoose={chooseVoice}
          onPreview={previewVoice}
          onClose={() => setShowVoicePicker(false)}
        />
      )}

    {shareCopied && (
      <div className="pointer-events-none fixed inset-x-0 top-16 z-50 flex justify-center">
        <div className="rounded-full bg-white/90 px-4 py-2 text-xs font-semibold text-ink shadow-lg">Copied to clipboard</div>
      </div>
    )}
    </>
  );
}
