import { StateCreator } from "zustand";
import { USERNAME_PATTERN } from "@/lib/chat/crypto";
import { transport } from "../transport";
import { ChatContact, ChatState, ContactsSlice } from "../types";

export const createContactsSlice: StateCreator<ChatState, [], [], ContactsSlice> = (set, get) => ({
  contacts: [],

  addContactByUsername: async (rawUsername) => {
    const username = rawUsername.trim();
    if (!USERNAME_PATTERN.test(username)) return { ok: false, reason: "invalid" };
    const identity = get().identity;
    if (!identity) return { ok: false, reason: "offline" };
    if (!transport.socket || transport.socket.readyState !== WebSocket.OPEN) return { ok: false, reason: "offline" };

    const result = await new Promise<{
      found: boolean;
      id?: string;
      username?: string;
      publicKeyJwk?: JsonWebKey;
      phone?: string;
      avatarDataUrl?: string;
    }>((resolve) => {
      transport.pendingLookups.set(username.toLowerCase(), { resolve });
      transport.socket!.send(JSON.stringify({ type: "lookup", username }));
    });

    if (!result.found || !result.id || !result.publicKeyJwk) return { ok: false, reason: "not_found" };
    if (result.id === identity.id) return { ok: false, reason: "self" };

    const existing = get().contacts.find((c) => c.id === result.id);
    const contact: ChatContact = {
      id: result.id,
      username: result.username ?? username,
      publicKeyJwk: result.publicKeyJwk,
      addedAt: existing?.addedAt ?? Date.now(),
      phone: result.phone,
      avatarDataUrl: result.avatarDataUrl,
    };
    transport.sharedKeyCache.delete(contact.id);
    set((s) => ({
      contacts: existing ? s.contacts.map((c) => (c.id === contact.id ? contact : c)) : [...s.contacts, contact],
    }));
    return { ok: true, contact };
  },

  removeContact: (id) => {
    transport.sharedKeyCache.delete(id);
    set((s) => {
      const { [id]: _removedMsgs, ...restMsgs } = s.messagesByContact;
      const { [id]: _removedUnread, ...restUnread } = s.unreadByContact;
      return {
        contacts: s.contacts.filter((c) => c.id !== id),
        messagesByContact: restMsgs,
        unreadByContact: restUnread,
      };
    });
  },
});
