// Helpers called across what are now different slice files (e.g. the
// connection slice's relay-message router needs to append a decrypted
// message, which conceptually belongs to messaging). Previously these were
// closures inside one big `create()` call, implicitly sharing that call's
// `set`/`get`. Since every slice is handed the *same* `set`/`get` (zustand's
// slices pattern types each slice against the whole combined ChatState),
// promoting them to plain functions that take `set`/`get` as parameters
// works identically at runtime and has a bonus: each one is now
// independently unit-testable by passing a mock set/get, which a closure
// bound to one particular `create()` call couldn't be.
import type { StoreApi } from "zustand";
import { decryptMessage, deriveSharedKey, encryptMessage } from "@/lib/chat/crypto";
import { notifyCallMedia, relayUrl, transport } from "./transport";
import { ChatContact, ChatMessageE2E, ChatState } from "./types";
import { HOUR, MOCK_CONTACTS } from "./mockContacts";

export type SetChat = StoreApi<ChatState>["setState"];
export type GetChat = StoreApi<ChatState>["getState"];

export function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export async function getSharedKey(get: GetChat, contact: ChatContact): Promise<CryptoKey | null> {
  const identity = get().identity;
  if (!identity) return null;
  const cached = transport.sharedKeyCache.get(contact.id);
  if (cached) return cached;
  const key = await deriveSharedKey(identity.privateKeyJwk, contact.publicKeyJwk);
  transport.sharedKeyCache.set(contact.id, key);
  return key;
}

export function updateMessage(set: SetChat, contactId: string, msgId: string, patch: Partial<ChatMessageE2E>) {
  set((s) => ({
    messagesByContact: {
      ...s.messagesByContact,
      [contactId]: (s.messagesByContact[contactId] ?? []).map((m) => (m.id === msgId ? { ...m, ...patch } : m)),
    },
  }));
}

export function appendMessage(set: SetChat, contactId: string, msg: ChatMessageE2E) {
  set((s) => ({
    messagesByContact: {
      ...s.messagesByContact,
      [contactId]: [...(s.messagesByContact[contactId] ?? []), msg],
    },
  }));
}

export function seedMockContactsIfEmpty(set: SetChat, get: GetChat) {
  if (get().contacts.length > 0) return;
  const now = Date.now();
  const contacts: ChatContact[] = [];
  const messagesByContact: Record<string, ChatMessageE2E[]> = {};
  for (const mock of MOCK_CONTACTS) {
    const id = uid("mock");
    contacts.push({ id, username: mock.username, publicKeyJwk: {} as JsonWebKey, addedAt: now, phone: mock.phone, isMock: true });
    messagesByContact[id] = mock.messages.map((m) => ({
      id: uid("msg"),
      direction: m.direction,
      text: m.text,
      at: now - m.hoursAgo * HOUR,
      status: m.status,
    }));
  }
  set({ contacts, messagesByContact });
}

// Looks the message up from state (rather than taking text/image as params)
// so a retry from flushOutbox and a fresh send both encrypt the exact same
// {text, imageDataUrl} payload from one source of truth.
export async function attemptDeliver(set: SetChat, get: GetChat, contactId: string, msgId: string) {
  const contact = get().contacts.find((c) => c.id === contactId);
  if (!contact) return;
  const msg = (get().messagesByContact[contactId] ?? []).find((m) => m.id === msgId);
  if (!msg) return;
  if (!transport.socket || transport.socket.readyState !== WebSocket.OPEN) {
    updateMessage(set, contactId, msgId, { status: "queued_local" });
    return;
  }
  const sharedKey = await getSharedKey(get, contact);
  if (!sharedKey) return;
  const payload = JSON.stringify({
    text: msg.text,
    imageDataUrl: msg.imageDataUrl,
    audioDataUrl: msg.audioDataUrl,
    audioDurationMs: msg.audioDurationMs,
  });
  const envelope = await encryptMessage(sharedKey, payload);
  updateMessage(set, contactId, msgId, { status: "sending" });
  transport.socket.send(JSON.stringify({ type: "send", to: contactId, envelope, msgId }));
}

export function flushOutbox(set: SetChat, get: GetChat) {
  const { messagesByContact } = get();
  for (const [contactId, msgs] of Object.entries(messagesByContact)) {
    for (const m of msgs) {
      if (m.direction === "out" && m.status === "queued_local") {
        void attemptDeliver(set, get, contactId, m.id);
      }
    }
  }
}

// The relay's username directory is in-memory and resets if it restarts.
// Re-claiming on every (re)connect is idempotent when we still own the
// name, and makes that recoverable without the user noticing. Also
// republishes the latest phone/avatar so a lookup after a profile edit sees
// current values.
export function reclaimUsernameIfAny(get: GetChat) {
  const identity = get().identity;
  if (identity?.username && transport.socket && transport.socket.readyState === WebSocket.OPEN) {
    transport.socket.send(
      JSON.stringify({
        type: "claim_username",
        username: identity.username,
        publicKeyJwk: identity.publicKeyJwk,
        phone: identity.phone,
        avatarDataUrl: identity.avatarDataUrl,
      })
    );
  }
}

export async function handleIncoming(
  set: SetChat,
  get: GetChat,
  from: string,
  envelope: { iv: string; ciphertext: string },
  msgId: string,
  ts: number
) {
  const contact = get().contacts.find((c) => c.id === from);
  if (!contact) {
    // No public key on file for this sender — can't derive a shared key, so
    // this can never be decrypted. Real E2E requires the pairing step
    // (adding each other) before messaging in either direction.
    console.warn(`[chat] dropped message from unknown contact ${from}`);
    return;
  }
  const sharedKey = await getSharedKey(get, contact);
  if (!sharedKey) return;
  try {
    const decrypted = await decryptMessage(sharedKey, envelope);
    // Payload is JSON ({text, imageDataUrl, audioDataUrl, audioDurationMs}) —
    // fall back to treating it as plain text if it's not (e.g. an older message shape).
    let text = decrypted;
    let imageDataUrl: string | undefined;
    let audioDataUrl: string | undefined;
    let audioDurationMs: number | undefined;
    try {
      const parsed = JSON.parse(decrypted) as {
        text?: string;
        imageDataUrl?: string;
        audioDataUrl?: string;
        audioDurationMs?: number;
      };
      text = parsed.text ?? "";
      imageDataUrl = parsed.imageDataUrl;
      audioDataUrl = parsed.audioDataUrl;
      audioDurationMs = parsed.audioDurationMs;
    } catch {
      // not JSON — treat the whole thing as plain text
    }
    appendMessage(set, from, { id: msgId, direction: "in", text, imageDataUrl, audioDataUrl, audioDurationMs, at: ts, status: "received" });
    set((s) => ({ unreadByContact: { ...s.unreadByContact, [from]: (s.unreadByContact[from] ?? 0) + 1 } }));
  } catch (err) {
    console.warn("[chat] failed to decrypt incoming message", err);
  }
}

/** Best-effort push of our current note/story to the relay, which
 * broadcasts it to every other connected client (demo-scale — the relay
 * has no reverse contact graph to scope this to just our contacts).
 * No-ops silently when offline; local state stays the source of truth for
 * our own UI either way. */
export function pushMyStatus(get: GetChat) {
  if (transport.socket && transport.socket.readyState === WebSocket.OPEN) {
    const { myNote, myStory } = get();
    transport.socket.send(JSON.stringify({ type: "status_update", note: myNote, story: myStory }));
  }
}

export function handleAck(set: SetChat, get: GetChat, msgId: string, queued: boolean) {
  for (const [contactId, msgs] of Object.entries(get().messagesByContact)) {
    if (msgs.some((m) => m.id === msgId)) {
      updateMessage(set, contactId, msgId, { status: queued ? "queued_remote" : "delivered" });
      return;
    }
  }
}

export function sendSignal(msg: Record<string, unknown>) {
  if (transport.socket && transport.socket.readyState === WebSocket.OPEN) transport.socket.send(JSON.stringify(msg));
}

export function teardownCallResources() {
  transport.localStream?.getTracks().forEach((t) => t.stop());
  transport.localStream = null;
  transport.remoteStream = null;
  transport.peerConnection?.close();
  transport.peerConnection = null;
  transport.pendingOfferSdp = null;
  transport.pendingRemoteIce = [];
  notifyCallMedia();
}

/** Local hangup: notifies the peer (if we have one to notify) and clears
 * everything. Used for end/reject/cancel and connection-drop. */
export function endCallLocally(set: SetChat, get: GetChat, notifyPeer: boolean) {
  const call = get().call;
  if (notifyPeer && call) sendSignal({ type: "call-end", to: call.contactId });
  teardownCallResources();
  set({ call: null });
}

// Re-exported (already imported above for this file's own use) so slices
// that pull cross-slice helpers from this one module don't also need a
// separate "../transport" import just for these two.
export { notifyCallMedia, relayUrl };

export function wirePeerConnection(set: SetChat, get: GetChat, pc: RTCPeerConnection, contactId: string) {
  pc.onicecandidate = (e) => {
    if (e.candidate) sendSignal({ type: "call-ice", to: contactId, candidate: e.candidate.toJSON() });
  };
  pc.ontrack = (e) => {
    if (!transport.remoteStream) transport.remoteStream = new MediaStream();
    transport.remoteStream.addTrack(e.track);
    notifyCallMedia();
  };
  pc.onconnectionstatechange = () => {
    if (pc !== transport.peerConnection) return;
    if (pc.connectionState === "connected") {
      set((s) => (s.call ? { call: { ...s.call, phase: "active", startedAt: s.call.startedAt ?? Date.now() } } : {}));
    } else if (pc.connectionState === "failed" || pc.connectionState === "closed") {
      endCallLocally(set, get, false);
    }
    // "disconnected" is transient — WebRTC often recovers on its own; only
    // tear down once it settles into failed/closed.
  };
}
