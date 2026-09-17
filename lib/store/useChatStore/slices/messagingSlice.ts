import { StateCreator } from "zustand";
import { transport } from "../transport";
import { ChatState, MessagingSlice } from "../types";
import { appendMessage, attemptDeliver, updateMessage, uid } from "../internal";

export const createMessagingSlice: StateCreator<ChatState, [], [], MessagingSlice> = (set, get) => ({
  messagesByContact: {},
  unreadByContact: {},

  sendMessage: async (contactId, text, imageDataUrl, audio) => {
    const trimmed = text.trim();
    if (!trimmed && !imageDataUrl && !audio) return;
    const msgId = uid("msg");
    appendMessage(set, contactId, {
      id: msgId,
      direction: "out",
      text: trimmed,
      imageDataUrl,
      audioDataUrl: audio?.dataUrl,
      audioDurationMs: audio?.durationMs,
      at: Date.now(),
      status: "sending",
    });
    const contact = get().contacts.find((c) => c.id === contactId);
    if (contact?.isMock) {
      // Not a real peer — no relay round trip (a fake publicKeyJwk would
      // fail deriveSharedKey anyway). Simulate a delivery.
      window.setTimeout(() => updateMessage(set, contactId, msgId, { status: "delivered" }), 500);
      return;
    }
    await attemptDeliver(set, get, contactId, msgId);
  },

  markRead: (contactId) => {
    const hadUnread = (get().unreadByContact[contactId] ?? 0) > 0;
    set((s) => ({ unreadByContact: { ...s.unreadByContact, [contactId]: 0 } }));
    if (hadUnread && transport.socket && transport.socket.readyState === WebSocket.OPEN) {
      transport.socket.send(JSON.stringify({ type: "read", to: contactId, at: Date.now() }));
    }
  },
});
