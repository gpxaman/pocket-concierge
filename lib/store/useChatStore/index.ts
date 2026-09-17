"use client";

// Same zustand slices pattern as lib/store/useAppStore — see that folder's
// index.ts for the general explanation. This store additionally has a
// genuinely shared "hub" (the connection slice's relay message router) and
// non-serializable transport state (./transport.ts) that no single domain
// slice could own; ./internal.ts holds the helpers several slices call
// into, promoted from private closures to explicit (set, get, ...)
// functions specifically so the split didn't have to fight zustand over
// which slice's closure "owns" a shared helper.
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ChatState } from "./types";
import { createIdentitySlice } from "./slices/identitySlice";
import { createContactsSlice } from "./slices/contactsSlice";
import { createMessagingSlice } from "./slices/messagingSlice";
import { createConnectionSlice } from "./slices/connectionSlice";
import { createCallSlice } from "./slices/callSlice";
import { createProfileSlice } from "./slices/profileSlice";
import { createSocialSlice } from "./slices/socialSlice";

export const useChatStore = create<ChatState>()(
  persist(
    (...a) => ({
      ...createIdentitySlice(...a),
      ...createContactsSlice(...a),
      ...createMessagingSlice(...a),
      ...createConnectionSlice(...a),
      ...createCallSlice(...a),
      ...createProfileSlice(...a),
      ...createSocialSlice(...a),
    }),
    {
      name: "pocket-concierge-chat",
      version: 3,
      // Unchanged from before the slice split: usernameStatus,
      // connectionStatus, call, onlineIds (a Set — not JSON-serializable
      // anyway), notesByContact and storiesByContact are all live/session
      // state that should NOT survive a reload.
      partialize: (s) => ({
        identity: s.identity,
        contacts: s.contacts,
        messagesByContact: s.messagesByContact,
        unreadByContact: s.unreadByContact,
        myStory: s.myStory,
        myNote: s.myNote,
      }),
    }
  )
);

// Re-exported so every existing `import { X } from "@/lib/store/useChatStore"`
// across the app keeps working unchanged.
export type {
  ChatContact,
  ChatMessageStatus,
  ChatMessageE2E,
  StoryItem,
  NoteItem,
  UsernameStatus,
  CallKind,
  CallPhase,
  CallState,
} from "./types";
export { STORY_TTL_MS, NOTE_TTL_MS, NOTE_COLORS, noteColor, NOTE_EMOJIS } from "./types";
export { subscribeCallMedia, getLocalCallStream, getRemoteCallStream } from "./transport";
