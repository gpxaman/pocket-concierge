// The relay WebSocket lives entirely inside this slice's `connect()`, but
// its `onmessage` router touches nearly every other slice's state
// (messaging, identity, contacts, calls, social) — that fan-out is
// inherent to being the one place relay frames arrive, not something a
// finer split could remove. Each branch delegates to a named helper in
// ../internal.ts rather than inlining logic here, so this file stays a
// dispatch table you can scan.
import { StateCreator } from "zustand";
import { signChallenge } from "@/lib/chat/crypto";
import { transport } from "../transport";
import { CallKind, ChatState, ConnectionSlice, NoteItem, StoryItem } from "../types";
import { flushOutbox, handleAck, handleIncoming, pushMyStatus, reclaimUsernameIfAny, relayUrl, teardownCallResources, updateMessage } from "../internal";

export const createConnectionSlice: StateCreator<ChatState, [], [], ConnectionSlice> = (set, get) => ({
  connectionStatus: "offline",
  onlineIds: new Set(),
  notesByContact: {},
  storiesByContact: {},

  connect: () => {
    if (typeof window === "undefined") return;
    const identity = get().identity;
    if (!identity) return;
    if (transport.socket && (transport.socket.readyState === WebSocket.OPEN || transport.socket.readyState === WebSocket.CONNECTING)) return;

    set({ connectionStatus: "connecting" });
    const ws = new WebSocket(relayUrl());
    transport.socket = ws;

    // No hello on open — the relay sends a fresh per-connection challenge
    // first, and only trusts `id` once we've signed it (see the "challenge"
    // branch below). Without this, any socket that simply claimed an id
    // would be believed, letting one user hijack another's live connection.
    ws.onmessage = (ev) => {
      let msg: { type: string; [k: string]: unknown };
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.type === "challenge") {
        void signChallenge(identity.signingPrivateKeyJwk, msg.nonce as string).then((signature) => {
          if (transport.socket !== ws || ws.readyState !== WebSocket.OPEN) return;
          ws.send(
            JSON.stringify({
              type: "hello",
              id: identity.id,
              signature,
              signingPublicKeyJwk: identity.signingPublicKeyJwk,
            })
          );
        });
      } else if (msg.type === "auth_failed") {
        // Someone else's connection is already bound to this id under a
        // different signing key (or the signature was otherwise invalid) —
        // do not retry with the same id, that would just loop forever.
        set({ connectionStatus: "offline" });
        ws.close();
      } else if (msg.type === "welcome") {
        set({ connectionStatus: "online" });
        flushOutbox(set, get);
        reclaimUsernameIfAny(get);
        pushMyStatus(get);
      } else if (msg.type === "presence_snapshot") {
        set({ onlineIds: new Set(msg.ids as string[]) });
      } else if (msg.type === "presence") {
        set((s) => {
          const next = new Set(s.onlineIds);
          if (msg.online) next.add(msg.id as string);
          else next.delete(msg.id as string);
          return { onlineIds: next };
        });
      } else if (msg.type === "status_snapshot") {
        const entries = msg.statuses as { id: string; note: NoteItem | null; story: StoryItem | null }[];
        set((s) => {
          const notesByContact = { ...s.notesByContact };
          const storiesByContact = { ...s.storiesByContact };
          for (const e of entries) {
            notesByContact[e.id] = e.note;
            storiesByContact[e.id] = e.story;
          }
          return { notesByContact, storiesByContact };
        });
      } else if (msg.type === "status_update") {
        const from = msg.from as string;
        set((s) => ({
          notesByContact: { ...s.notesByContact, [from]: (msg.note as NoteItem | null) ?? null },
          storiesByContact: { ...s.storiesByContact, [from]: (msg.story as StoryItem | null) ?? null },
        }));
      } else if (msg.type === "read") {
        const from = msg.from as string;
        const at = msg.at as number;
        const msgs = get().messagesByContact[from] ?? [];
        for (const m of msgs) {
          if (m.direction === "out" && m.at <= at && (m.status === "delivered" || m.status === "queued_remote")) {
            updateMessage(set, from, m.id, { status: "read" });
          }
        }
      } else if (msg.type === "message") {
        void handleIncoming(set, get, msg.from as string, msg.envelope as { iv: string; ciphertext: string }, msg.msgId as string, msg.ts as number);
      } else if (msg.type === "ack") {
        handleAck(set, get, msg.msgId as string, Boolean(msg.queued));
      } else if (msg.type === "username_ok") {
        transport.pendingUsernameClaim?.resolve({ ok: true });
        transport.pendingUsernameClaim = null;
        set((s) => ({
          identity: s.identity ? { ...s.identity, username: msg.username as string } : s.identity,
          usernameStatus: "set",
        }));
      } else if (msg.type === "username_taken") {
        transport.pendingUsernameClaim?.resolve({ ok: false, reason: (msg.reason as "invalid" | "taken") ?? "taken" });
        transport.pendingUsernameClaim = null;
      } else if (msg.type === "lookup_result") {
        const key = (msg.query as string).toLowerCase();
        const pending = transport.pendingLookups.get(key);
        transport.pendingLookups.delete(key);
        pending?.resolve(
          msg.found
            ? {
                found: true,
                id: msg.id as string,
                username: msg.username as string,
                publicKeyJwk: msg.publicKeyJwk as JsonWebKey,
                phone: msg.phone as string | undefined,
                avatarDataUrl: msg.avatarDataUrl as string | undefined,
              }
            : { found: false }
        );
      } else if (msg.type === "call-offer") {
        const from = msg.from as string;
        const existingCall = get().call;
        if (existingCall) {
          // Already on/starting a call — busy. Auto-decline so the caller
          // isn't left hanging (no call-waiting in this scope).
          if (transport.socket && transport.socket.readyState === WebSocket.OPEN) {
            transport.socket.send(JSON.stringify({ type: "call-end", to: from }));
          }
          return;
        }
        transport.pendingOfferSdp = msg.sdp as RTCSessionDescriptionInit;
        transport.pendingRemoteIce = [];
        set({
          call: { contactId: from, kind: msg.kind as CallKind, phase: "incoming", startedAt: null, muted: false, cameraOff: false },
        });
      } else if (msg.type === "call-answer") {
        const call = get().call;
        if (!call || call.contactId !== (msg.from as string) || !transport.peerConnection) return;
        void transport.peerConnection.setRemoteDescription(msg.sdp as RTCSessionDescriptionInit).then(async () => {
          for (const c of transport.pendingRemoteIce) await transport.peerConnection?.addIceCandidate(c).catch(() => {});
          transport.pendingRemoteIce = [];
          set((s) => (s.call ? { call: { ...s.call, phase: "connecting" } } : {}));
        });
      } else if (msg.type === "call-ice") {
        const call = get().call;
        if (!call || call.contactId !== (msg.from as string)) return;
        const candidate = msg.candidate as RTCIceCandidateInit;
        if (transport.peerConnection?.remoteDescription) void transport.peerConnection.addIceCandidate(candidate).catch(() => {});
        else transport.pendingRemoteIce.push(candidate);
      } else if (msg.type === "call-end") {
        const call = get().call;
        if (!call || call.contactId !== (msg.from as string)) return;
        teardownCallResources();
        set({ call: null, callEndedReason: "Call ended" });
      } else if (msg.type === "call-unavailable") {
        const call = get().call;
        if (!call || call.contactId !== (msg.to as string)) return;
        teardownCallResources();
        set({ call: null, callEndedReason: "They're not online right now" });
      }
    };
    ws.onclose = () => {
      if (transport.socket === ws) transport.socket = null;
      set({ connectionStatus: "offline", onlineIds: new Set() });
      if (transport.reconnectTimer) clearTimeout(transport.reconnectTimer);
      transport.reconnectTimer = setTimeout(() => get().connect(), 2000);
    };
    ws.onerror = () => ws.close();
  },

  disconnect: () => {
    if (transport.reconnectTimer) {
      clearTimeout(transport.reconnectTimer);
      transport.reconnectTimer = null;
    }
    transport.socket?.close();
    transport.socket = null;
    set({ connectionStatus: "offline" });
  },
});
