import { StateCreator } from "zustand";
import { generateIdentityKeyPair, USERNAME_PATTERN } from "@/lib/chat/crypto";
import { transport } from "../transport";
import { ChatIdentity, ChatState, IdentitySlice } from "../types";
import { seedMockContactsIfEmpty, uid } from "../internal";

export const createIdentitySlice: StateCreator<ChatState, [], [], IdentitySlice> = (set, get) => ({
  identity: null,
  usernameStatus: "unset",

  ensureIdentity: async () => {
    const existing = get().identity;
    if (existing) return existing;
    const { publicKeyJwk, privateKeyJwk } = await generateIdentityKeyPair();
    const identity: ChatIdentity = { id: uid("user"), username: null, publicKeyJwk, privateKeyJwk };
    set({ identity });
    seedMockContactsIfEmpty(set, get);
    return identity;
  },

  claimUsername: async (rawUsername) => {
    const username = rawUsername.trim();
    if (!USERNAME_PATTERN.test(username)) {
      set({ usernameStatus: "invalid" });
      return { ok: false, reason: "invalid" };
    }
    const identity = get().identity;
    if (!identity) return { ok: false, reason: "offline" };
    if (!transport.socket || transport.socket.readyState !== WebSocket.OPEN) return { ok: false, reason: "offline" };

    set({ usernameStatus: "checking" });
    const result = await new Promise<{ ok: true } | { ok: false; reason: "invalid" | "taken" | "offline" }>((resolve) => {
      transport.pendingUsernameClaim = { resolve };
      transport.socket!.send(
        JSON.stringify({
          type: "claim_username",
          username,
          publicKeyJwk: identity.publicKeyJwk,
          phone: identity.phone,
          avatarDataUrl: identity.avatarDataUrl,
        })
      );
    });

    if (result.ok) {
      set((s) => ({ identity: s.identity ? { ...s.identity, username } : s.identity, usernameStatus: "set" }));
    } else {
      set({ usernameStatus: result.reason === "invalid" ? "invalid" : "taken" });
    }
    return result;
  },
});
