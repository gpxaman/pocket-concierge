// Minimal WebSocket relay for the E2E chat feature. It does three jobs,
// none of which involve reading message content:
//
// 1. Authenticates each connection's claimed id via a signed challenge (see
//    below) before trusting anything else it says.
// 2. Routes encrypted envelopes between connected clients by id, with a
//    short in-memory queue for anyone currently offline. Every "envelope"
//    it forwards is opaque ciphertext produced by lib/chat/crypto.ts on the
//    sender's device and only decryptable by the intended recipient.
// 3. Runs a username -> {id, publicKeyJwk} directory so contacts can be
//    added by typing a username instead of pasting a key blob. This is the
//    one piece of real "server knowledge" here — same trust model as
//    Signal/Session usernames: the directory maps identity to a *public*
//    key, message content is still only ever readable by sender/recipient.
//
// Connection authentication (why): originally any socket could just say
// `{type: "hello", id: "someone-elses-id"}` and be believed — no proof
// required. Since a contact's id is visible in places like the app's
// /chat/[contactId] URL, that meant anyone who learned/guessed an id could
// hijack that person's live connection: kick their real session, steal
// their queued messages, and even overwrite their username directory entry
// with a different public key (impersonating them to anyone who looks them
// up afterward). Now every connection gets a random nonce immediately on
// open and must sign it with the identity's ECDSA signing key (see
// lib/chat/crypto.ts's generateSigningKeyPair/signChallenge) before `hello`
// is accepted. The first connection ever seen for a given id binds that
// id's signing key (trust-on-first-use, same model the username directory
// already uses); every later connection claiming that id must produce a
// valid signature under the SAME key, or it's rejected outright.
//
// State is in-memory only (no DB, matches this whole project's demo scope):
// restarting this process drops undelivered queued messages, the username
// directory, AND id->signing-key bindings (clients silently re-authenticate
// and re-claim their username on reconnect — see useChatStore's
// `connect()`/`reclaimUsernameIfAny`).
//
// Run standalone: `node server/chat-relay.mjs`
// Or via `npm run dev:all`, which runs this alongside `next dev`.

import { WebSocketServer } from "ws";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.CHAT_RELAY_PORT || 8787);
const MAX_QUEUE_PER_CLIENT = 200;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

// Cheap abuse resistance for a public-facing demo process: caps how much
// any single IP or connection can do. Not a substitute for a real gateway
// (no persistence across restarts, no distributed tracking across
// instances), but stops the trivial cases — one script opening thousands of
// sockets, or one connection flooding `send`/`claim_username` calls.
const MAX_CONNECTIONS_PER_IP = 20;
const MESSAGE_RATE_LIMIT = 30; // per window
const MESSAGE_RATE_WINDOW_MS = 10_000;
const AUTH_TIMEOUT_MS = 10_000; // must complete the challenge/hello handshake this fast

/** @type {Map<string, import('ws').WebSocket>} live, AUTHENTICATED connections, by id */
const clients = new Map();
/** @type {Map<string, object[]>} queued frames, by recipient id */
const queues = new Map();
/** @type {Map<string, {id: string, username: string, publicKeyJwk: object, phone?: string, avatarDataUrl?: string}>} directory, keyed by lowercased username */
const usernames = new Map();
/** @type {Map<string, object>} the signing public key (JWK) each id first authenticated with — trust-on-first-use binding, checked on every later connection */
const idSigningKeys = new Map();
/** @type {Map<string, {note: object|null, story: object|null}>} latest note/story per id — demo-scale: broadcast to everyone connected, no reverse contact graph to scope to. */
const statuses = new Map();
/** @type {Map<string, number>} live connection count per IP */
const connectionsByIp = new Map();

const wss = new WebSocketServer({ port: PORT, host: "0.0.0.0" });

async function verifySignature(publicKeyJwk, nonce, signatureB64) {
  try {
    const key = await crypto.subtle.importKey("jwk", publicKeyJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    const signature = Uint8Array.from(atob(signatureB64), (c) => c.charCodeAt(0));
    return await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, signature, new TextEncoder().encode(nonce));
  } catch {
    return false; // malformed key/signature — treat exactly like a failed verification, not a crash
  }
}

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

function broadcast(msg, exceptId) {
  for (const [id, sock] of clients) {
    if (id !== exceptId) send(sock, msg);
  }
}

wss.on("connection", (ws, req) => {
  const ip = req.socket.remoteAddress ?? "unknown";
  const ipCount = connectionsByIp.get(ip) ?? 0;
  if (ipCount >= MAX_CONNECTIONS_PER_IP) {
    ws.close(1008, "too many connections");
    return;
  }
  connectionsByIp.set(ip, ipCount + 1);

  let selfId = null;
  let authenticated = false;
  const nonce = randomUUID();
  send(ws, { type: "challenge", nonce });

  const authTimer = setTimeout(() => {
    if (!authenticated) ws.close(1008, "auth timeout");
  }, AUTH_TIMEOUT_MS);

  // Simple fixed-window token bucket per connection — cheap and sufficient
  // for a demo relay; doesn't need to survive a reconnect.
  let msgCount = 0;
  let windowStart = Date.now();
  function rateLimited() {
    const now = Date.now();
    if (now - windowStart > MESSAGE_RATE_WINDOW_MS) {
      windowStart = now;
      msgCount = 0;
    }
    msgCount++;
    return msgCount > MESSAGE_RATE_LIMIT;
  }

  ws.on("message", (raw) => {
    if (rateLimited()) return; // silently drop — no need to tell an abusive client why

    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === "hello" && typeof msg.id === "string" && msg.id && typeof msg.signature === "string" && msg.signingPublicKeyJwk) {
      void (async () => {
        const boundKey = idSigningKeys.get(msg.id);
        // Trust-on-first-use: the first connection to ever claim this id
        // sets its signing key. Every later connection claiming the same id
        // must sign with that same key, or it's rejected — this is what
        // actually stops identity hijacking, not just the presence of a
        // signature.
        const keyToVerify = boundKey ?? msg.signingPublicKeyJwk;
        const valid = await verifySignature(keyToVerify, nonce, msg.signature);
        if (!valid) {
          send(ws, { type: "auth_failed" });
          ws.close(1008, "auth failed");
          return;
        }
        if (!boundKey) idSigningKeys.set(msg.id, msg.signingPublicKeyJwk);

        authenticated = true;
        clearTimeout(authTimer);
        selfId = msg.id;
        // A second device/tab reconnecting with the same (now-authenticated) id replaces the old socket.
        const existing = clients.get(selfId);
        if (existing && existing !== ws) existing.close();
        clients.set(selfId, ws);
        send(ws, { type: "welcome", id: selfId });
        send(ws, { type: "presence_snapshot", ids: [...clients.keys()].filter((id) => id !== selfId) });
        const statusSnapshot = [...statuses.entries()].map(([id, s]) => ({ id, note: s.note, story: s.story }));
        if (statusSnapshot.length > 0) send(ws, { type: "status_snapshot", statuses: statusSnapshot });
        flushQueue(selfId, ws);
        broadcast({ type: "presence", id: selfId, online: true }, selfId);
      })();
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
      // phone/avatarDataUrl are optional display-only profile fields — never
      // used as a lookup key, just carried through so a fresh lookup sees them.
      usernames.set(key, {
        id: selfId,
        username,
        publicKeyJwk: msg.publicKeyJwk,
        phone: typeof msg.phone === "string" ? msg.phone : undefined,
        avatarDataUrl: typeof msg.avatarDataUrl === "string" ? msg.avatarDataUrl : undefined,
      });
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
          phone: entry.phone,
          avatarDataUrl: entry.avatarDataUrl,
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

    if (msg.type === "read" && selfId && msg.to && typeof msg.at === "number") {
      const frame = { type: "read", from: selfId, at: msg.at };
      const target = clients.get(msg.to);
      if (target && target.readyState === target.OPEN) {
        send(target, frame);
      } else {
        const q = queueFor(msg.to);
        q.push(frame);
        if (q.length > MAX_QUEUE_PER_CLIENT) q.shift();
      }
      return;
    }

    if (msg.type === "status_update" && selfId) {
      const note = msg.note ?? null;
      const story = msg.story ?? null;
      statuses.set(selfId, { note, story });
      broadcast({ type: "status_update", from: selfId, note, story }, selfId);
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
    clearTimeout(authTimer);
    const ipCountNow = connectionsByIp.get(ip) ?? 1;
    if (ipCountNow <= 1) connectionsByIp.delete(ip);
    else connectionsByIp.set(ip, ipCountNow - 1);
    if (selfId && clients.get(selfId) === ws) {
      clients.delete(selfId);
      broadcast({ type: "presence", id: selfId, online: false });
    }
    // Username claims AND id->signing-key bindings deliberately outlive the
    // socket — someone should stay findable (and unable to be impersonated)
    // while offline.
  });
});

console.log(`[chat-relay] listening on ws://0.0.0.0:${PORT}`);
