// Minimal WebSocket relay for the E2E chat feature. It does two jobs, both
// with zero knowledge of message content:
//
// 1. Routes encrypted envelopes between connected clients by id, with a
//    short in-memory queue for anyone currently offline. Every "envelope"
//    it forwards is opaque ciphertext produced by lib/chat/crypto.ts on the
//    sender's device and only decryptable by the intended recipient.
// 2. Runs a username -> {id, publicKeyJwk} directory so contacts can be
//    added by typing a username instead of pasting a key blob. This is the
//    one piece of real "server knowledge" here — same trust model as
//    Signal/Session usernames: the directory maps identity to a *public*
//    key, message content is still only ever readable by sender/recipient.
//
// State is in-memory only (no DB, matches this whole project's demo scope):
// restarting this process drops undelivered queued messages AND the
// username directory (clients silently re-claim their username on
// reconnect — see useChatStore's `connect()`).
//
// Run standalone: `node server/chat-relay.mjs`
// Or via `npm run dev:all`, which runs this alongside `next dev`.

import { WebSocketServer } from "ws";

const PORT = Number(process.env.CHAT_RELAY_PORT || 8787);
const MAX_QUEUE_PER_CLIENT = 200;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

/** @type {Map<string, import('ws').WebSocket>} live connections, by id */
const clients = new Map();
/** @type {Map<string, object[]>} queued frames, by recipient id */
const queues = new Map();
/** @type {Map<string, {id: string, username: string, publicKeyJwk: object}>} directory, keyed by lowercased username */
const usernames = new Map();

const wss = new WebSocketServer({ port: PORT, host: "0.0.0.0" });

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function queueFor(id) {
  let q = queues.get(id);
  if (!q) {
    q = [];
    queues.set(id, q);
  }
  return q;
}

function flushQueue(id, ws) {
  const q = queues.get(id);
  if (!q || q.length === 0) return;
  for (const msg of q) send(ws, msg);
  queues.delete(id);
}

wss.on("connection", (ws) => {
  let selfId = null;

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === "hello" && typeof msg.id === "string" && msg.id) {
      selfId = msg.id;
      // A second device/tab reconnecting with the same id replaces the old socket.
      const existing = clients.get(selfId);
      if (existing && existing !== ws) existing.close();
      clients.set(selfId, ws);
      send(ws, { type: "welcome", id: selfId });
      flushQueue(selfId, ws);
      return;
    }

    if (msg.type === "claim_username" && selfId && typeof msg.username === "string" && msg.publicKeyJwk) {
      const username = msg.username.trim();
      if (!USERNAME_RE.test(username)) {
        send(ws, { type: "username_taken", username, reason: "invalid" });
        return;
      }
      const key = username.toLowerCase();
      const existing = usernames.get(key);
      if (existing && existing.id !== selfId) {
        send(ws, { type: "username_taken", username, reason: "taken" });
        return;
      }
      usernames.set(key, { id: selfId, username, publicKeyJwk: msg.publicKeyJwk });
      send(ws, { type: "username_ok", username });
      return;
    }

    if (msg.type === "lookup" && typeof msg.username === "string") {
      const entry = usernames.get(msg.username.trim().toLowerCase());
      if (entry) {
        send(ws, {
          type: "lookup_result",
          query: msg.username,
          found: true,
          id: entry.id,
          username: entry.username,
          publicKeyJwk: entry.publicKeyJwk,
        });
      } else {
        send(ws, { type: "lookup_result", query: msg.username, found: false });
      }
      return;
    }

    if (msg.type === "send" && selfId && msg.to && msg.envelope && msg.msgId) {
      const frame = { type: "message", from: selfId, envelope: msg.envelope, msgId: msg.msgId, ts: Date.now() };
      const target = clients.get(msg.to);
      if (target && target.readyState === target.OPEN) {
        send(target, frame);
        send(ws, { type: "ack", msgId: msg.msgId, queued: false });
      } else {
        const q = queueFor(msg.to);
        q.push(frame);
        if (q.length > MAX_QUEUE_PER_CLIENT) q.shift();
        send(ws, { type: "ack", msgId: msg.msgId, queued: true });
      }
      return;
    }

    // Call signaling (WebRTC offer/answer/ICE trickle + hangup): pure
    // passthrough, live-only — never queued, since a call only makes sense
    // if the other side is connected right now. The relay never touches
    // media; SDP/ICE just describe how to set up a direct (or STUN-assisted)
    // peer connection, and the actual audio/video is DTLS-SRTP encrypted
    // end-to-end between the two browsers once connected.
    if (msg.type === "call-offer" && selfId && msg.to && msg.sdp && msg.kind) {
      const target = clients.get(msg.to);
      if (target && target.readyState === target.OPEN) {
        send(target, { type: "call-offer", from: selfId, kind: msg.kind, sdp: msg.sdp });
      } else {
        send(ws, { type: "call-unavailable", to: msg.to });
      }
      return;
    }

    if (msg.type === "call-answer" && selfId && msg.to && msg.sdp) {
      const target = clients.get(msg.to);
      if (target && target.readyState === target.OPEN) send(target, { type: "call-answer", from: selfId, sdp: msg.sdp });
      return;
    }

    if (msg.type === "call-ice" && selfId && msg.to && msg.candidate) {
      const target = clients.get(msg.to);
      if (target && target.readyState === target.OPEN) send(target, { type: "call-ice", from: selfId, candidate: msg.candidate });
      return;
    }

    if (msg.type === "call-end" && selfId && msg.to) {
      const target = clients.get(msg.to);
      if (target && target.readyState === target.OPEN) send(target, { type: "call-end", from: selfId });
      return;
    }
  });

  ws.on("close", () => {
    if (selfId && clients.get(selfId) === ws) clients.delete(selfId);
    // Username claims deliberately outlive the socket — someone should stay
    // findable (and able to receive queued messages) while offline.
  });
});

console.log(`[chat-relay] listening on ws://0.0.0.0:${PORT}`);
