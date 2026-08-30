"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { decryptMessage, deriveSharedKey, encryptMessage, generateIdentityKeyPair, USERNAME_PATTERN } from "@/lib/chat/crypto";
import { AUDIO_CONSTRAINTS, VIDEO_CONSTRAINTS, applyHighQualityEncoding, createPeerConnection } from "@/lib/chat/webrtc";

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export interface ChatContact {
  id: string;
  username: string;
  publicKeyJwk: JsonWebKey;
  addedAt: number;
}

export type ChatMessageStatus = "sending" | "delivered" | "queued_remote" | "queued_local" | "received";

export interface ChatMessageE2E {
  id: string;
  direction: "in" | "out";
  text: string;
  at: number;
  status: ChatMessageStatus;
}

interface ChatIdentity {
  id: string;
  username: string | null;
  publicKeyJwk: JsonWebKey;
  privateKeyJwk: JsonWebKey;
}

export type UsernameStatus = "unset" | "checking" | "set" | "taken" | "invalid";
type ClaimResult = { ok: true } | { ok: false; reason: "invalid" | "taken" | "offline" };
type AddContactResult = { ok: true; contact: ChatContact } | { ok: false; reason: "invalid" | "not_found" | "self" | "offline" };

export type CallKind = "audio" | "video";
export type CallPhase = "outgoing" | "incoming" | "connecting" | "active";

export interface CallState {
  contactId: string;
  kind: CallKind;
  phase: CallPhase;
  startedAt: number | null;
  muted: boolean;
  cameraOff: boolean;
}

interface ChatState {
  identity: ChatIdentity | null;
  usernameStatus: UsernameStatus;
  contacts: ChatContact[];
  messagesByContact: Record<string, ChatMessageE2E[]>;
  unreadByContact: Record<string, number>;
  connectionStatus: "connecting" | "online" | "offline";
  call: CallState | null;
  callEndedReason: string | null;

  ensureIdentity: () => Promise<ChatIdentity>;
  claimUsername: (username: string) => Promise<ClaimResult>;
  addContactByUsername: (username: string) => Promise<AddContactResult>;
  removeContact: (id: string) => void;
  sendMessage: (contactId: string, text: string) => Promise<void>;
  markRead: (contactId: string) => void;
  connect: () => void;
  disconnect: () => void;

  startCall: (contactId: string, kind: CallKind) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  clearCallEndedReason: () => void;
}

// WebSocket, reconnect timer, pending request resolvers, the derived-key
// cache, and everything WebRTC (peer connection, media streams, buffered
// ICE) all live outside the store: none of it is serializable, so none of
// it belongs in persisted state.
let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const sharedKeyCache = new Map<string, CryptoKey>();
let pendingUsernameClaim: { resolve: (r: ClaimResult) => void } | null = null;
const pendingLookups = new Map<string, { resolve: (r: { found: boolean; id?: string; username?: string; publicKeyJwk?: JsonWebKey }) => void }>();

let peerConnection: RTCPeerConnection | null = null;
let localStream: MediaStream | null = null;
let remoteStream: MediaStream | null = null;
let pendingOfferSdp: RTCSessionDescriptionInit | null = null;
let pendingRemoteIce: RTCIceCandidateInit[] = [];
const callMediaListeners = new Set<() => void>();

function notifyCallMedia() {
  callMediaListeners.forEach((fn) => fn());
}
/** Subscribe to local/remote call media changes — used by CallOverlay to
 * know when to (re)attach streams to <video>/<audio> elements, since
 * MediaStream objects deliberately never enter zustand state. */
export function subscribeCallMedia(fn: () => void): () => void {
  callMediaListeners.add(fn);
  return () => callMediaListeners.delete(fn);
}
export function getLocalCallStream(): MediaStream | null {
  return localStream;
}
export function getRemoteCallStream(): MediaStream | null {
  return remoteStream;
}

function relayUrl(): string {
  if (typeof window === "undefined") return "";
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  const port = process.env.NEXT_PUBLIC_CHAT_RELAY_PORT || "8787";
  return `${proto}://${window.location.hostname}:${port}`;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => {
      async function getSharedKey(contact: ChatContact): Promise<CryptoKey | null> {
        const identity = get().identity;
        if (!identity) return null;
        const cached = sharedKeyCache.get(contact.id);
        if (cached) return cached;
        const key = await deriveSharedKey(identity.privateKeyJwk, contact.publicKeyJwk);
        sharedKeyCache.set(contact.id, key);
        return key;
      }

      function updateMessage(contactId: string, msgId: string, patch: Partial<ChatMessageE2E>) {
        set((s) => ({
          messagesByContact: {
            ...s.messagesByContact,
            [contactId]: (s.messagesByContact[contactId] ?? []).map((m) => (m.id === msgId ? { ...m, ...patch } : m)),
          },
        }));
      }

      function appendMessage(contactId: string, msg: ChatMessageE2E) {
        set((s) => ({
          messagesByContact: {
            ...s.messagesByContact,
            [contactId]: [...(s.messagesByContact[contactId] ?? []), msg],
          },
        }));
      }

      async function attemptDeliver(contactId: string, msgId: string, text: string) {
        const contact = get().contacts.find((c) => c.id === contactId);
        if (!contact) return;
        if (!socket || socket.readyState !== WebSocket.OPEN) {
          updateMessage(contactId, msgId, { status: "queued_local" });
          return;
        }
        const sharedKey = await getSharedKey(contact);
        if (!sharedKey) return;
        const envelope = await encryptMessage(sharedKey, text);
        updateMessage(contactId, msgId, { status: "sending" });
        socket.send(JSON.stringify({ type: "send", to: contactId, envelope, msgId }));
      }

      function flushOutbox() {
        const { messagesByContact } = get();
        for (const [contactId, msgs] of Object.entries(messagesByContact)) {
          for (const m of msgs) {
            if (m.direction === "out" && m.status === "queued_local") {
              void attemptDeliver(contactId, m.id, m.text);
            }
          }
        }
      }

      // The relay's username directory is in-memory and resets if it
      // restarts. Re-claiming on every (re)connect is idempotent when we
      // still own the name, and makes that recoverable without the user
      // noticing.
      function reclaimUsernameIfAny() {
        const identity = get().identity;
        if (identity?.username && socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "claim_username", username: identity.username, publicKeyJwk: identity.publicKeyJwk }));
        }
      }

      async function handleIncoming(from: string, envelope: { iv: string; ciphertext: string }, msgId: string, ts: number) {
        const contact = get().contacts.find((c) => c.id === from);
        if (!contact) {
          // No public key on file for this sender — can't derive a shared key,
          // so this can never be decrypted. Real E2E requires the pairing step
          // (adding each other) before messaging in either direction.
          console.warn(`[chat] dropped message from unknown contact ${from}`);
          return;
        }
        const sharedKey = await getSharedKey(contact);
        if (!sharedKey) return;
        try {
          const text = await decryptMessage(sharedKey, envelope);
          appendMessage(from, { id: msgId, direction: "in", text, at: ts, status: "received" });
          set((s) => ({ unreadByContact: { ...s.unreadByContact, [from]: (s.unreadByContact[from] ?? 0) + 1 } }));
        } catch (err) {
          console.warn("[chat] failed to decrypt incoming message", err);
        }
      }

      function handleAck(msgId: string, queued: boolean) {
        for (const [contactId, msgs] of Object.entries(get().messagesByContact)) {
          if (msgs.some((m) => m.id === msgId)) {
            updateMessage(contactId, msgId, { status: queued ? "queued_remote" : "delivered" });
            return;
          }
        }
      }

      function sendSignal(msg: Record<string, unknown>) {
        if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
      }

      function teardownCallResources() {
        localStream?.getTracks().forEach((t) => t.stop());
        localStream = null;
        remoteStream = null;
        peerConnection?.close();
        peerConnection = null;
        pendingOfferSdp = null;
        pendingRemoteIce = [];
        notifyCallMedia();
      }

      /** Local hangup: notifies the peer (if we have one to notify) and
       * clears everything. Used for end/reject/cancel and connection-drop. */
      function endCallLocally(notifyPeer: boolean) {
        const call = get().call;
        if (notifyPeer && call) sendSignal({ type: "call-end", to: call.contactId });
        teardownCallResources();
        set({ call: null });
      }

      function wirePeerConnection(pc: RTCPeerConnection, contactId: string) {
        pc.onicecandidate = (e) => {
          if (e.candidate) sendSignal({ type: "call-ice", to: contactId, candidate: e.candidate.toJSON() });
        };
        pc.ontrack = (e) => {
          if (!remoteStream) remoteStream = new MediaStream();
          remoteStream.addTrack(e.track);
          notifyCallMedia();
        };
        pc.onconnectionstatechange = () => {
          if (pc !== peerConnection) return;
          if (pc.connectionState === "connected") {
            set((s) => (s.call ? { call: { ...s.call, phase: "active", startedAt: s.call.startedAt ?? Date.now() } } : {}));
          } else if (pc.connectionState === "failed" || pc.connectionState === "closed") {
            endCallLocally(false);
          } else if (pc.connectionState === "disconnected") {
            // Transient — WebRTC often recovers on its own; only tear down
            // once it settles into failed/closed.
          }
        };
      }

      return {
        identity: null,
        usernameStatus: "unset",
        contacts: [],
        messagesByContact: {},
        unreadByContact: {},
        connectionStatus: "offline",
        call: null,
        callEndedReason: null,

        ensureIdentity: async () => {
          const existing = get().identity;
          if (existing) return existing;
          const { publicKeyJwk, privateKeyJwk } = await generateIdentityKeyPair();
          const identity: ChatIdentity = { id: uid("user"), username: null, publicKeyJwk, privateKeyJwk };
          set({ identity });
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
          if (!socket || socket.readyState !== WebSocket.OPEN) return { ok: false, reason: "offline" };

          set({ usernameStatus: "checking" });
          const result = await new Promise<ClaimResult>((resolve) => {
            pendingUsernameClaim = { resolve };
            socket!.send(JSON.stringify({ type: "claim_username", username, publicKeyJwk: identity.publicKeyJwk }));
          });

          if (result.ok) {
            set((s) => ({ identity: s.identity ? { ...s.identity, username } : s.identity, usernameStatus: "set" }));
          } else {
            set({ usernameStatus: result.reason === "invalid" ? "invalid" : "taken" });
          }
          return result;
        },

        addContactByUsername: async (rawUsername) => {
          const username = rawUsername.trim();
          if (!USERNAME_PATTERN.test(username)) return { ok: false, reason: "invalid" };
          const identity = get().identity;
          if (!identity) return { ok: false, reason: "offline" };
          if (!socket || socket.readyState !== WebSocket.OPEN) return { ok: false, reason: "offline" };

          const result = await new Promise<{ found: boolean; id?: string; username?: string; publicKeyJwk?: JsonWebKey }>(
            (resolve) => {
              pendingLookups.set(username.toLowerCase(), { resolve });
              socket!.send(JSON.stringify({ type: "lookup", username }));
            }
          );

          if (!result.found || !result.id || !result.publicKeyJwk) return { ok: false, reason: "not_found" };
          if (result.id === identity.id) return { ok: false, reason: "self" };

          const existing = get().contacts.find((c) => c.id === result.id);
          const contact: ChatContact = {
            id: result.id,
            username: result.username ?? username,
            publicKeyJwk: result.publicKeyJwk,
            addedAt: existing?.addedAt ?? Date.now(),
          };
          sharedKeyCache.delete(contact.id);
          set((s) => ({
            contacts: existing ? s.contacts.map((c) => (c.id === contact.id ? contact : c)) : [...s.contacts, contact],
          }));
          return { ok: true, contact };
        },

        removeContact: (id) => {
          sharedKeyCache.delete(id);
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

        sendMessage: async (contactId, text) => {
          const trimmed = text.trim();
          if (!trimmed) return;
          const msgId = uid("msg");
          appendMessage(contactId, { id: msgId, direction: "out", text: trimmed, at: Date.now(), status: "sending" });
          await attemptDeliver(contactId, msgId, trimmed);
        },

        markRead: (contactId) => set((s) => ({ unreadByContact: { ...s.unreadByContact, [contactId]: 0 } })),

        connect: () => {
          if (typeof window === "undefined") return;
          const identity = get().identity;
          if (!identity) return;
          if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;

          set({ connectionStatus: "connecting" });
          const ws = new WebSocket(relayUrl());
          socket = ws;

          ws.onopen = () => {
            ws.send(JSON.stringify({ type: "hello", id: identity.id }));
          };
          ws.onmessage = (ev) => {
            let msg: { type: string; [k: string]: unknown };
            try {
              msg = JSON.parse(ev.data);
            } catch {
              return;
            }
            if (msg.type === "welcome") {
              set({ connectionStatus: "online" });
              flushOutbox();
              reclaimUsernameIfAny();
            } else if (msg.type === "message") {
              void handleIncoming(
                msg.from as string,
                msg.envelope as { iv: string; ciphertext: string },
                msg.msgId as string,
                msg.ts as number
              );
            } else if (msg.type === "ack") {
              handleAck(msg.msgId as string, Boolean(msg.queued));
            } else if (msg.type === "username_ok") {
              pendingUsernameClaim?.resolve({ ok: true });
              pendingUsernameClaim = null;
              set((s) => ({
                identity: s.identity ? { ...s.identity, username: msg.username as string } : s.identity,
                usernameStatus: "set",
              }));
            } else if (msg.type === "username_taken") {
              pendingUsernameClaim?.resolve({ ok: false, reason: (msg.reason as "invalid" | "taken") ?? "taken" });
              pendingUsernameClaim = null;
            } else if (msg.type === "lookup_result") {
              const key = (msg.query as string).toLowerCase();
              const pending = pendingLookups.get(key);
              pendingLookups.delete(key);
              pending?.resolve(
                msg.found
                  ? { found: true, id: msg.id as string, username: msg.username as string, publicKeyJwk: msg.publicKeyJwk as JsonWebKey }
                  : { found: false }
              );
            } else if (msg.type === "call-offer") {
              const from = msg.from as string;
              const existingCall = get().call;
              if (existingCall) {
                // Already on/starting a call — busy. Auto-decline so the
                // caller isn't left hanging (no call-waiting in this scope).
                sendSignal({ type: "call-end", to: from });
                return;
              }
              pendingOfferSdp = msg.sdp as RTCSessionDescriptionInit;
              pendingRemoteIce = [];
              set({
                call: { contactId: from, kind: msg.kind as CallKind, phase: "incoming", startedAt: null, muted: false, cameraOff: false },
              });
            } else if (msg.type === "call-answer") {
              const call = get().call;
              if (!call || call.contactId !== (msg.from as string) || !peerConnection) return;
              void peerConnection.setRemoteDescription(msg.sdp as RTCSessionDescriptionInit).then(async () => {
                for (const c of pendingRemoteIce) await peerConnection?.addIceCandidate(c).catch(() => {});
                pendingRemoteIce = [];
                set((s) => (s.call ? { call: { ...s.call, phase: "connecting" } } : {}));
              });
            } else if (msg.type === "call-ice") {
              const call = get().call;
              if (!call || call.contactId !== (msg.from as string)) return;
              const candidate = msg.candidate as RTCIceCandidateInit;
              if (peerConnection?.remoteDescription) void peerConnection.addIceCandidate(candidate).catch(() => {});
              else pendingRemoteIce.push(candidate);
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
            if (socket === ws) socket = null;
            set({ connectionStatus: "offline" });
            if (reconnectTimer) clearTimeout(reconnectTimer);
            reconnectTimer = setTimeout(() => get().connect(), 2000);
          };
          ws.onerror = () => ws.close();
        },

        disconnect: () => {
          if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
          }
          socket?.close();
          socket = null;
          set({ connectionStatus: "offline" });
        },

        startCall: async (contactId, kind) => {
          if (get().call) return;
          const contact = get().contacts.find((c) => c.id === contactId);
          if (!contact || !socket || socket.readyState !== WebSocket.OPEN) return;

          set({ call: { contactId, kind, phase: "outgoing", startedAt: null, muted: false, cameraOff: false }, callEndedReason: null });

          try {
            localStream = await navigator.mediaDevices.getUserMedia({
              video: kind === "video" ? VIDEO_CONSTRAINTS : false,
              audio: AUDIO_CONSTRAINTS,
            });
            notifyCallMedia();

            const pc = createPeerConnection();
            peerConnection = pc;
            wirePeerConnection(pc, contactId);
            localStream.getTracks().forEach((t) => pc.addTrack(t, localStream!));

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            await applyHighQualityEncoding(pc);
            sendSignal({ type: "call-offer", to: contactId, kind, sdp: pc.localDescription });
          } catch (err) {
            console.warn("[call] failed to start", err);
            teardownCallResources();
            set({ call: null, callEndedReason: "Couldn't access camera/microphone" });
          }
        },

        acceptCall: async () => {
          const call = get().call;
          if (!call || call.phase !== "incoming" || !pendingOfferSdp) return;

          try {
            localStream = await navigator.mediaDevices.getUserMedia({
              video: call.kind === "video" ? VIDEO_CONSTRAINTS : false,
              audio: AUDIO_CONSTRAINTS,
            });
            notifyCallMedia();

            const pc = createPeerConnection();
            peerConnection = pc;
            wirePeerConnection(pc, call.contactId);
            localStream.getTracks().forEach((t) => pc.addTrack(t, localStream!));

            await pc.setRemoteDescription(pendingOfferSdp);
            for (const c of pendingRemoteIce) await pc.addIceCandidate(c).catch(() => {});
            pendingRemoteIce = [];

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await applyHighQualityEncoding(pc);
            sendSignal({ type: "call-answer", to: call.contactId, sdp: pc.localDescription });

            set((s) => (s.call ? { call: { ...s.call, phase: "connecting" } } : {}));
          } catch (err) {
            console.warn("[call] failed to accept", err);
            endCallLocally(true);
            set({ callEndedReason: "Couldn't access camera/microphone" });
          }
        },

        rejectCall: () => endCallLocally(true),
        endCall: () => endCallLocally(true),

        toggleMute: () => {
          const track = localStream?.getAudioTracks()[0];
          if (!track) return;
          track.enabled = !track.enabled;
          set((s) => (s.call ? { call: { ...s.call, muted: !track.enabled } } : {}));
        },

        toggleCamera: () => {
          const track = localStream?.getVideoTracks()[0];
          if (!track) return;
          track.enabled = !track.enabled;
          set((s) => (s.call ? { call: { ...s.call, cameraOff: !track.enabled } } : {}));
        },

        clearCallEndedReason: () => set({ callEndedReason: null }),
      };
    },
    {
      name: "pocket-concierge-chat",
      version: 3,
      partialize: (s) => ({
        identity: s.identity,
        contacts: s.contacts,
        messagesByContact: s.messagesByContact,
        unreadByContact: s.unreadByContact,
      }),
    }
  )
);
