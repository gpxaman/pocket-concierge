"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChatMessageE2E, useChatStore } from "@/lib/store/useChatStore";
import { ChevronLeft, Send, Lock, Check, CheckCheck, Clock, Phone, Video, Paperclip, X, Smile } from "lucide-react";
import clsx from "clsx";
import EmojiPicker from "@/components/chat/EmojiPicker";
import VoiceRecorder from "@/components/chat/VoiceRecorder";
import VoiceBubble from "@/components/chat/VoiceBubble";

// Stable reference: `?? []` inline in a selector would allocate a new array
// every render, which makes useSyncExternalStore think the snapshot changed
// on every call and spin into an infinite render loop.
const EMPTY_MESSAGES: ChatMessageE2E[] = [];

export default function ConversationPage() {
  const params = useParams<{ contactId: string }>();
  const router = useRouter();
  const contactId = params.contactId;

  const identity = useChatStore((s) => s.identity);
  const contact = useChatStore((s) => s.contacts.find((c) => c.id === contactId));
  const messages = useChatStore((s) => s.messagesByContact[contactId] ?? EMPTY_MESSAGES);
  const connectionStatus = useChatStore((s) => s.connectionStatus);
  const ensureIdentity = useChatStore((s) => s.ensureIdentity);
  const connect = useChatStore((s) => s.connect);
  const markRead = useChatStore((s) => s.markRead);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const call = useChatStore((s) => s.call);
  const startCall = useChatStore((s) => s.startCall);
  const onlineIds = useChatStore((s) => s.onlineIds);
  const isOnline = onlineIds.has(contactId);

  const [input, setInput] = useState("");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function insertEmoji(emoji: string) {
    const el = inputRef.current;
    if (el && document.activeElement === el) {
      const start = el.selectionStart ?? input.length;
      const end = el.selectionEnd ?? input.length;
      const next = input.slice(0, start) + emoji + input.slice(end);
      setInput(next);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + emoji.length, start + emoji.length);
      });
    } else {
      setInput((v) => v + emoji);
    }
  }

  function handleImageSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setPendingImage(reader.result);
    };
    reader.readAsDataURL(file);
  }

  useEffect(() => {
    (async () => {
      await ensureIdentity();
      connect();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    markRead(contactId);
  }, [contactId, markRead, messages.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  if (!identity) return null;

  if (!contact) {
    return (
      <div className="px-5 pt-6">
        <button onClick={() => router.push("/chat")} className="inline-flex items-center gap-1 text-sm text-ink/50 hover:text-ink">
          <ChevronLeft size={16} /> Messages
        </button>
        <p className="mt-8 text-center text-sm text-ink/40">Contact not found — it may have been removed.</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col">
      <div className="flex items-center gap-3 border-b border-black/5 px-5 py-4">
        <button onClick={() => router.push("/chat")} className="text-ink/50 hover:text-ink">
          <ChevronLeft size={20} />
        </button>
        {contact.avatarDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={contact.avatarDataUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accentSoft text-sm font-semibold text-accentDark">
            {contact.username.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">@{contact.username}</p>
          {isOnline ? (
            <p className="text-[11px] font-medium text-accentDark">online</p>
          ) : (
            <p className="inline-flex items-center gap-1 text-[11px] text-ink/40">
              <Lock size={9} /> End-to-end encrypted · {connectionStatus}
            </p>
          )}
        </div>
        <button
          onClick={() => startCall(contactId, "audio")}
          disabled={!!call || connectionStatus !== "online"}
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink/50 hover:bg-accentSoft hover:text-accentDark disabled:opacity-30"
          title="Voice call"
        >
          <Phone size={17} />
        </button>
        <button
          onClick={() => startCall(contactId, "video")}
          disabled={!!call || connectionStatus !== "online"}
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink/50 hover:bg-accentSoft hover:text-accentDark disabled:opacity-30"
          title="Video call"
        >
          <Video size={17} />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
        {messages.length === 0 ? (
          <p className="mt-10 text-center text-sm text-ink/35">
            Say hello — only you and @{contact.username} can read this.
          </p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={clsx("flex", m.direction === "out" ? "justify-end" : "justify-start")}>
              <div
                className={clsx(
                  "max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm leading-relaxed",
                  m.direction === "out" ? "bg-accent text-ink" : "bg-white text-ink shadow-sm"
                )}
              >
                {m.imageDataUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.imageDataUrl} alt="" className={clsx("max-h-64 rounded-lg object-cover", (m.text || m.audioDataUrl) && "mb-2")} />
                )}
                {m.audioDataUrl && (
                  <VoiceBubble dataUrl={m.audioDataUrl} durationMs={m.audioDurationMs} tone={m.direction === "out" ? "out" : "in"} />
                )}
                {m.text}
                {m.direction === "out" && (
                  <span className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-ink/45">
                    {m.status === "read" && (
                      <>
                        <CheckCheck size={11} className="text-accentDark" /> <span className="text-accentDark">read</span>
                      </>
                    )}
                    {m.status === "delivered" && (
                      <>
                        <CheckCheck size={11} /> delivered
                      </>
                    )}
                    {m.status === "queued_remote" && (
                      <>
                        <Check size={11} /> sent
                      </>
                    )}
                    {(m.status === "sending" || m.status === "queued_local") && (
                      <>
                        <Clock size={11} /> {m.status === "queued_local" ? "waiting for connection" : "sending…"}
                      </>
                    )}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelected} />

      {pendingImage && (
        <div className="mx-4 mb-2 flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pendingImage} alt="Selected" className="h-10 w-10 rounded-lg object-cover" />
          <span className="flex-1 text-xs text-ink/50">Image attached — will send with your next message</span>
          <button
            onClick={() => setPendingImage(null)}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-black/5 text-ink/60 hover:bg-black/10"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {showEmojiPicker && <EmojiPicker onPick={insertEmoji} onClose={() => setShowEmojiPicker(false)} />}

      <div className="mx-4 mb-3 flex items-center gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!input.trim() && !pendingImage) return;
            void sendMessage(contactId, input, pendingImage ?? undefined);
            setInput("");
            setPendingImage(null);
            setShowEmojiPicker(false);
          }}
          className="flex flex-1 items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-2 shadow-sm"
        >
          <button
            type="button"
            onClick={() => setShowEmojiPicker((v) => !v)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink/50 hover:text-ink"
            title="Emoji"
          >
            <Smile size={17} />
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink/50 hover:text-ink"
            title="Attach an image"
          >
            <Paperclip size={16} />
          </button>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setShowEmojiPicker(false)}
            placeholder="Message…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink/35"
          />
          {(input.trim() || pendingImage) && (
            <button
              type="submit"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-ink transition"
            >
              <Send size={15} />
            </button>
          )}
        </form>
        {!input.trim() && !pendingImage && (
          <VoiceRecorder onSend={(dataUrl, durationMs) => void sendMessage(contactId, "", undefined, { dataUrl, durationMs })} />
        )}
      </div>
    </div>
  );
}
