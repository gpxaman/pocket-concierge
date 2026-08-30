"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/lib/store/useAppStore";
import { ChatMessage, ServiceCategory } from "@/lib/types";
import { findById } from "@/lib/data/catalog";
import { CATEGORY_ICON } from "@/lib/data/categoryIcons";
import ItemCard from "@/components/ItemCard";
import VoiceOverlay from "@/components/VoiceOverlay";
import { Mic, Send, Sparkles } from "lucide-react";
import clsx from "clsx";

const QUICK_ACTIONS: { category: ServiceCategory; label: string; prompt: string }[] = [
  {
    category: "electronics",
    label: "Laptop for college",
    prompt: "I need a laptop for college, coding and some editing. Budget around 80,000, want it to last 4 years.",
  },
  { category: "fashion", label: "Formal shirt", prompt: "Find me a black formal shirt under 3,000." },
  { category: "hotels", label: "Hotel this weekend", prompt: "Book a hotel for this weekend, something with free cancellation." },
  { category: "food", label: "Order food", prompt: "I'm hungry, find me something good nearby." },
  { category: "rides", label: "Get a ride", prompt: "Get me a ride." },
];

function renderInline(text: string) {
  // Chat bubbles are plain text (no markdown renderer). The system prompt asks
  // models to skip markdown bullets, but Gemini in particular still emits
  // "*   item" list lines sometimes — normalize those to a real bullet glyph
  // so a broken instruction-follow doesn't leak raw asterisks into the UI.
  const normalized = text.replace(/^\s*\*(?!\*)\s+/gm, "• ");
  // **bold** is still supported and split out separately below.
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

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const chipVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: 0.15 + i * 0.06, duration: 0.35 } }),
};

export default function ChatPanel() {
  const chatMessages = useAppStore((s) => s.chatMessages);
  const addChatMessage = useAppStore((s) => s.addChatMessage);
  const logAudit = useAppStore((s) => s.logAudit);
  const displayName = useAppStore((s) => s.displayName);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chatMessages, loading]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    const userMsg: ChatMessage = { id: uid(), role: "user", content: text.trim(), createdAt: Date.now() };
    const history = [...chatMessages, userMsg];
    addChatMessage(userMsg);
    setInput("");
    setLoading(true);

    logAudit({
      actorType: "USER",
      action: "conversation_turn",
      resourceType: "conversation",
      policyDecision: "allowed",
      detail: text.trim().slice(0, 140),
    });

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      const data = await res.json();
      const assistantMsg: ChatMessage = {
        id: uid(),
        role: "assistant",
        content: data.reply,
        itemIds: data.itemIds ?? [],
        mode: data.mode,
        createdAt: Date.now(),
      };
      addChatMessage(assistantMsg);
      logAudit({
        actorType: "AI_AGENT",
        action: "recommendation_presented",
        resourceType: "conversation",
        policyDecision: "allowed",
        detail: `${(data.itemIds ?? []).length} item(s) recommended via ${data.mode} mode.`,
      });
    } catch {
      addChatMessage({
        id: uid(),
        role: "assistant",
        content: "Something went wrong reaching the concierge. Try again.",
        createdAt: Date.now(),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col">
      <div className="relative overflow-hidden rounded-b-[2rem] bg-gradient-to-br from-[#171106] via-[#221904] to-[#0e0a03] px-5 pb-7 pt-7">
        <div className="orb orb-a h-40 w-40 bg-accent" style={{ top: "-3rem", left: "-2rem" }} />
        <div className="orb orb-b h-32 w-32 bg-[#ffe27a]" style={{ top: "1rem", right: "-2.5rem" }} />
        <div className="orb orb-c h-28 w-28 bg-white" style={{ bottom: "-2.5rem", left: "40%" }} />

        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium tracking-wide text-white/80 backdrop-blur"
        >
          <Sparkles size={12} className="text-accent" />
          POCKET CONCIERGE
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08 }}
          className="relative mt-3 text-[28px] font-semibold leading-tight text-white"
        >
          {displayName ? `Hey ${displayName}, ` : ""}
          <span className="shimmer-text">what can I help you with?</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="relative mt-1.5 max-w-[90%] text-sm text-white/50"
        >
          Text, talk, or tap something below — I'll ask only what I actually need to know.
        </motion.p>
      </div>

      <div ref={scrollRef} className="mt-4 flex-1 space-y-3 overflow-y-auto px-5 pb-3">
        {chatMessages.length === 0 && (
          <motion.div initial="hidden" animate="visible" className="flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((q, i) => {
              const Icon = CATEGORY_ICON[q.category];
              return (
                <motion.button
                  key={q.label}
                  custom={i}
                  variants={chipVariants}
                  whileHover={{ scale: 1.04, borderColor: "#a16207" }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => send(q.prompt)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1.5 text-left text-xs text-ink/70 shadow-sm transition-colors"
                >
                  <Icon size={13} className="text-accentDark" /> {q.label}
                </motion.button>
              );
            })}
          </motion.div>
        )}

        <AnimatePresence initial={false}>
          {chatMessages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className={clsx("flex", m.role === "user" ? "justify-end" : "justify-start")}
            >
              <div className={clsx("max-w-[85%] space-y-2", m.role === "user" ? "items-end" : "items-start")}>
                <div
                  className={clsx(
                    "whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                    m.role === "user" ? "bg-accent text-ink" : "bg-white text-ink shadow-sm"
                  )}
                >
                  {renderInline(m.content)}
                </div>
                {m.role === "assistant" && m.mode === "fallback" && (
                  <p className="px-1 text-[10px] text-ink/35">Demo mode — no GEMINI_API_KEY / ANTHROPIC_API_KEY set.</p>
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
                          <ItemCard item={item} />
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-xs text-ink/40 shadow-sm w-fit"
          >
            <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}>
              <Sparkles size={13} className="text-accentDark" />
            </motion.span>
            <span className="flex gap-0.5">
              <span className="bounce-dot" style={{ animationDelay: "0ms" }}>●</span>
              <span className="bounce-dot" style={{ animationDelay: "150ms" }}>●</span>
              <span className="bounce-dot" style={{ animationDelay: "300ms" }}>●</span>
            </span>
          </motion.div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mx-4 mb-3 flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-2 shadow-sm transition-shadow focus-within:border-accentDark/50 focus-within:shadow-[0_0_0_4px_rgba(245,197,24,0.18)]"
      >
        <button
          type="button"
          onClick={() => setVoiceOpen(true)}
          className="text-ink/35 hover:text-accentDark"
          title="Talk to the concierge"
        >
          <Mic size={18} />
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tell me what you're trying to do…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink/35"
        />
        <motion.button
          whileTap={{ scale: 0.88 }}
          type="submit"
          disabled={loading || !input.trim()}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-ink transition disabled:opacity-30"
        >
          <Send size={15} />
        </motion.button>
      </form>

      <VoiceOverlay open={voiceOpen} onClose={() => setVoiceOpen(false)} />
    </div>
  );
}
