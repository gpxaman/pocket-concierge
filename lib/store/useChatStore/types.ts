// All slice interfaces + the combined ChatState live in one file for the
// same reason as lib/store/useAppStore/types.ts: every slice needs
// `ChatState` for its `StateCreator<ChatState, [], [], ThisSlice>` typing,
// and `ChatState` is the intersection of every slice — putting them
// together avoids a circular type import.

export interface ChatContact {
  id: string;
  username: string;
  publicKeyJwk: JsonWebKey;
  addedAt: number;
  /** Display-only for now — not a second lookup key. */
  phone?: string;
  avatarDataUrl?: string;
  /** Seeded demo contact — never a real peer, so sendMessage simulates delivery locally instead of hitting the relay. */
  isMock?: boolean;
}

export type ChatMessageStatus = "sending" | "delivered" | "queued_remote" | "queued_local" | "received" | "read";

export interface ChatMessageE2E {
  id: string;
  direction: "in" | "out";
  text: string;
  /** An image attached to this message (e.g. a Snap sent to a contact). */
  imageDataUrl?: string;
  /** A held-to-record voice note, as a base64 audio data URL. */
  audioDataUrl?: string;
  audioDurationMs?: number;
  at: number;
  status: ChatMessageStatus;
}

export interface ChatIdentity {
  id: string;
  username: string | null;
  publicKeyJwk: JsonWebKey;
  privateKeyJwk: JsonWebKey;
  /** Proves control of `id` to the relay on connect — see lib/chat/crypto.ts's signChallenge. */
  signingPublicKeyJwk: JsonWebKey;
  signingPrivateKeyJwk: JsonWebKey;
  phone?: string;
  avatarDataUrl?: string;
}

export interface StoryItem {
  dataUrl: string;
  createdAt: number;
}
export interface NoteItem {
  text: string;
  /** An emoji badge shown alongside the note (real Instagram Notes support this — verified via research). */
  emoji?: string;
  /** Id into NOTE_COLORS — a colored bubble background (real Instagram Notes feature added mid-2025). */
  color?: string;
  createdAt: number;
}
export const STORY_TTL_MS = 24 * 60 * 60 * 1000;
export const NOTE_TTL_MS = 24 * 60 * 60 * 1000;

/** Curated bubble-background presets, matching the style of Instagram's colored Notes. */
export const NOTE_COLORS: { id: string; label: string; from: string; to: string; text: string }[] = [
  { id: "default", label: "Default", from: "#ffffff", to: "#ffffff", text: "#1a1508" },
  { id: "purple", label: "Purple", from: "#c9a7f0", to: "#8b5cf6", text: "#ffffff" },
  { id: "pink", label: "Pink", from: "#f9a8d4", to: "#ec4899", text: "#ffffff" },
  { id: "blue", label: "Blue", from: "#93c5fd", to: "#3b82f6", text: "#ffffff" },
  { id: "green", label: "Green", from: "#86efac", to: "#22c55e", text: "#ffffff" },
  { id: "orange", label: "Orange", from: "#fdba74", to: "#f97316", text: "#ffffff" },
  { id: "yellow", label: "Yellow", from: "#fde68a", to: "#eab308", text: "#1a1508" },
];
export function noteColor(id: string | undefined) {
  return NOTE_COLORS.find((c) => c.id === id) ?? NOTE_COLORS[0];
}

/** A small curated emoji set for the note badge — not a full picker, matches the app's other lightweight preset patterns. */
export const NOTE_EMOJIS = ["😀", "😂", "😍", "🔥", "🎉", "👀", "💭", "🙏", "😴", "🤔", "❤️", "👋"];

export type UsernameStatus = "unset" | "checking" | "set" | "taken" | "invalid";
export type ClaimResult = { ok: true } | { ok: false; reason: "invalid" | "taken" | "offline" };
export type AddContactResult = { ok: true; contact: ChatContact } | { ok: false; reason: "invalid" | "not_found" | "self" | "offline" };

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

export interface IdentitySlice {
  identity: ChatIdentity | null;
  usernameStatus: UsernameStatus;
  ensureIdentity: () => Promise<ChatIdentity>;
  claimUsername: (username: string) => Promise<ClaimResult>;
}

export interface ContactsSlice {
  contacts: ChatContact[];
  addContactByUsername: (username: string) => Promise<AddContactResult>;
  removeContact: (id: string) => void;
}

export interface MessagingSlice {
  messagesByContact: Record<string, ChatMessageE2E[]>;
  unreadByContact: Record<string, number>;
  sendMessage: (contactId: string, text: string, imageDataUrl?: string, audio?: { dataUrl: string; durationMs: number }) => Promise<void>;
  markRead: (contactId: string) => void;
}

export interface ConnectionSlice {
  connectionStatus: "connecting" | "online" | "offline";
  /** Live-only (not persisted) — who's currently connected to the relay. Repopulated on every connect via presence_snapshot. */
  onlineIds: Set<string>;
  notesByContact: Record<string, NoteItem | null>;
  storiesByContact: Record<string, StoryItem | null>;
  connect: () => void;
  disconnect: () => void;
}

export interface CallSlice {
  call: CallState | null;
  callEndedReason: string | null;
  startCall: (contactId: string, kind: CallKind) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  clearCallEndedReason: () => void;
}

export interface ProfileSlice {
  setOwnPhone: (phone: string) => void;
  setOwnAvatar: (dataUrl: string) => void;
}

export interface SocialSlice {
  myStory: StoryItem | null;
  myNote: NoteItem | null;
  setMyStory: (dataUrl: string) => void;
  clearMyStory: () => void;
  setMyNote: (text: string, opts?: { emoji?: string; color?: string }) => void;
  clearMyNote: () => void;
}

export type ChatState = IdentitySlice &
  ContactsSlice &
  MessagingSlice &
  ConnectionSlice &
  CallSlice &
  ProfileSlice &
  SocialSlice;
