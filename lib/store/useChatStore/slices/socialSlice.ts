import { StateCreator } from "zustand";
import { ChatState, SocialSlice } from "../types";
import { pushMyStatus } from "../internal";

export const createSocialSlice: StateCreator<ChatState, [], [], SocialSlice> = (set, get) => ({
  myStory: null,
  myNote: null,

  setMyStory: (dataUrl) => {
    set({ myStory: { dataUrl, createdAt: Date.now() } });
    pushMyStatus(get);
  },
  clearMyStory: () => {
    set({ myStory: null });
    pushMyStatus(get);
  },
  setMyNote: (text, opts) => {
    const trimmed = text.trim().slice(0, 60);
    if (!trimmed) return;
    set({ myNote: { text: trimmed, emoji: opts?.emoji, color: opts?.color, createdAt: Date.now() } });
    pushMyStatus(get);
  },
  clearMyNote: () => {
    set({ myNote: null });
    pushMyStatus(get);
  },
});
