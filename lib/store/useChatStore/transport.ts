// Every non-serializable, connection-lifetime-scoped piece of chat state
// lives here as one mutable object — never in zustand state, since a
// WebSocket/RTCPeerConnection/MediaStream can't survive serialization and
// shouldn't survive a persisted-state rehydration anyway. Shared by every
// slice that needs the wire (connection, messaging, identity, calls) via
// lib/store/useChatStore/internal.ts.
//
// Deliberately a plain object with mutable properties rather than
// `export let` bindings: ESM live-binding reassignment semantics differ
// subtly across bundlers/test runners, while `transport.socket = x` is
// unambiguous mutation that behaves identically everywhere (Next/Turbopack
// at runtime, Vitest in tests).
import { ClaimResult } from "./types";

interface PendingLookupResolver {
  resolve: (r: { found: boolean; id?: string; username?: string; publicKeyJwk?: JsonWebKey; phone?: string; avatarDataUrl?: string }) => void;
}

export const transport = {
  socket: null as WebSocket | null,
  reconnectTimer: null as ReturnType<typeof setTimeout> | null,
  sharedKeyCache: new Map<string, CryptoKey>(),
  pendingUsernameClaim: null as { resolve: (r: ClaimResult) => void } | null,
  pendingLookups: new Map<string, PendingLookupResolver>(),

  // WebRTC call transport
  peerConnection: null as RTCPeerConnection | null,
  localStream: null as MediaStream | null,
  remoteStream: null as MediaStream | null,
  pendingOfferSdp: null as RTCSessionDescriptionInit | null,
  pendingRemoteIce: [] as RTCIceCandidateInit[],
};

const callMediaListeners = new Set<() => void>();
export function notifyCallMedia() {
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
  return transport.localStream;
}
export function getRemoteCallStream(): MediaStream | null {
  return transport.remoteStream;
}

export function relayUrl(): string {
  if (typeof window === "undefined") return "";
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  const port = process.env.NEXT_PUBLIC_CHAT_RELAY_PORT || "8787";
  return `${proto}://${window.location.hostname}:${port}`;
}
