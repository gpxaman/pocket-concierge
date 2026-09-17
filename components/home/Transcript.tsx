"use client";

import { Ref } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import clsx from "clsx";
import { ChatMessage } from "@/lib/types";
import { findById } from "@/lib/data/catalog";
import { renderInline } from "@/lib/home/renderInline";
import ItemCard from "@/components/ItemCard";

export default function Transcript({
  scrollRef,
  chatMessages,
  loading,
}: {
  scrollRef: Ref<HTMLDivElement>;
  chatMessages: ChatMessage[];
  loading: boolean;
}) {
  return (
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
  );
}
