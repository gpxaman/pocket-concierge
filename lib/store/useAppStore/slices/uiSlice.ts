// The AI concierge's own in-app conversation (HomeAgent.tsx) + the display
// name shown throughout the app. Distinct from useChatStore, which is
// person-to-person E2E messaging — unrelated feature, unrelated store.
import { StateCreator } from "zustand";
import { AppState, UiSlice } from "../types";

export const createUiSlice: StateCreator<AppState, [], [], UiSlice> = (set) => ({
  chatMessages: [],
  displayName: "",

  addChatMessage: (m) => set((s) => ({ chatMessages: [...s.chatMessages, m] })),
  clearChat: () => set({ chatMessages: [] }),
  setDisplayName: (name) => set({ displayName: name }),
});
