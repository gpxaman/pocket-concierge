"use client";

import { useState } from "react";
import { useSnapStore } from "@/lib/store/useSnapStore";
import { useChatStore } from "@/lib/store/useChatStore";
import { X, Download, Send, BookOpen } from "lucide-react";

/**
 * Snapchat-style post-capture review: full-screen photo with Save (to
 * Memories) / Send (to a contact, over the real E2E chat pipeline) — or, in
 * "for story" mode (reached via /snap?for=story), a single "Post to Story"
 * action instead. Used for both fresh captures and Camera Roll picks.
 */
export default function SnapReviewScreen({
  dataUrl,
  filterName,
  forStory,
  onClose,
}: {
  dataUrl: string;
  filterName: string;
  forStory: boolean;
  onClose: () => void;
}) {
  const addSnap = useSnapStore((s) => s.addSnap);
  const setMyStory = useChatStore((s) => s.setMyStory);
  const contacts = useChatStore((s) => s.contacts);
  const sendMessage = useChatStore((s) => s.sendMessage);

  const [showSendSheet, setShowSendSheet] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  function flashAndClose(message: string) {
    setConfirmation(message);
    window.setTimeout(() => {
      setConfirmation(null);
      onClose();
    }, 700);
  }

  function handleSave() {
    addSnap(dataUrl, filterName);
    flashAndClose("Saved to Memories");
  }
  function handlePostStory() {
    setMyStory(dataUrl);
    flashAndClose("Posted to your story");
  }
  function handleSendTo(contactId: string) {
    void sendMessage(contactId, "", dataUrl);
    setShowSendSheet(false);
    flashAndClose("Sent!");
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-black">
      <div className="relative flex-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={dataUrl} alt="Captured" className="h-full w-full object-cover" />
        <button
          onClick={onClose}
          className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white"
        >
          <X size={18} />
        </button>
        {confirmation && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <p className="rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-ink">{confirmation}</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-8 bg-black py-5">
        {forStory ? (
          <button
            onClick={handlePostStory}
            className="flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-ink"
          >
            <BookOpen size={16} /> Post to Story
          </button>
        ) : (
          <>
            <button onClick={handleSave} className="flex flex-col items-center gap-1.5 text-white">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
                <Download size={20} />
              </span>
              <span className="text-[11px]">Save</span>
            </button>
            <button onClick={() => setShowSendSheet(true)} className="flex flex-col items-center gap-1.5 text-white">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-ink">
                <Send size={22} />
              </span>
              <span className="text-[11px]">Send</span>
            </button>
          </>
        )}
      </div>

      {showSendSheet && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={() => setShowSendSheet(false)}>
          <div className="max-h-[70vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 pb-6" onClick={(e) => e.stopPropagation()}>
            <p className="mb-3 text-center text-sm font-semibold text-ink">Send to</p>
            {contacts.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink/40">No contacts yet — add one from Chat first.</p>
            ) : (
              <div className="space-y-1">
                {contacts.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleSendTo(c.id)}
                    className="flex w-full items-center gap-3 rounded-xl2 px-2 py-2.5 text-left hover:bg-black/[0.03]"
                  >
                    {c.avatarDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.avatarDataUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accentSoft text-sm font-semibold text-accentDark">
                        {c.username.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm font-medium text-ink">@{c.username}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
