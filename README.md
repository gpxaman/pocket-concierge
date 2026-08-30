# Pocket Concierge — AI concierge demo

A working slice of the AI-Native Super App PRD/TRD: an AI-first home,
a mock shared service catalog (electronics, food, grocery, fashion, hotels,
rides, services), a manual Explore marketplace over the *same* catalog, and
a draft → explicit-authorization → lifecycle transaction flow (PRD §8) with
saved cards, an order-history ledger, and an AI action audit trail (TRD §23.3).

There is no real database or payment provider — state lives in the browser
(`localStorage` via zustand) so the core app runs with just
`npm install && npm run dev`. The one exception is direct messages, which
need the small relay process described below (`npm run dev:all` runs both).

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## AI mode

By default there's no API key, so `/api/ai/chat` uses a small rule-based
fallback agent (`lib/ai/fallback.ts`) — enough to try every category end to
end with zero config.

For the real reasoning concierge — a tool-use loop over `search_catalog` /
`get_item` / `present_recommendations`, see `app/api/ai/chat/route.ts` —
copy `.env.example` to `.env.local` and set one of:

```
GEMINI_API_KEY=...      # checked first — get one at https://aistudio.google.com/apikey
ANTHROPIC_API_KEY=sk-ant-...
```

Restart `npm run dev` after adding a key (env vars are read at process start).

## Voice mode

Tap the mic icon in the input bar for a full-screen, ChatGPT-style voice
mode (`components/VoiceOverlay.tsx`): an animated orb that listens via the
browser's Web Speech API, sends what you said through the same
`/api/ai/chat` endpoint as text chat, and speaks the reply back
(`speechSynthesis`) before listening again — a continuous loop until you
close it. Tap the keyboard icon any time to type instead of talking; both
paths write into the same shared conversation, so switching mid-task keeps
context. Voice recognition needs a Chromium-based browser and mic
permission — unsupported browsers (or a denied prompt) fall straight back
to the typed field.

## Direct messages (E2E encrypted)

Tap the message bubble (bottom-right, on any screen except Chat itself) to
open `/chat`: a real, working end-to-end encrypted direct-message feature
between any two people running this app — not part of the original PRD, but
independent of the AI concierge's own conversation.

**How it actually works, and why "wifi/data/SMS/Bluetooth" became "wifi or
data, with a username to find each other":** a browser can't send SMS and
can't do phone-to-phone Bluetooth messaging (Web Bluetooth only pairs with
specific BLE peripherals, not other phones) — so real message delivery here
is internet-only, over a WebSocket relay (`server/chat-relay.mjs`), which
works identically on wifi or mobile data.

Pairing is by username: each identity claims a unique `@username` (relay
enforces uniqueness), and adding a contact is a `lookup` call to the relay
that resolves a username to `{id, publicKeyJwk}`. That's the one thing the
relay actually knows — same trust model as Signal/Session usernames: a
public directory entry, not a decryption capability. Message *content* is
still only ever readable by sender and recipient. Two people must each add
the other's username before messaging works in either direction (standard
for E2E — you can't derive a shared key from a public key you don't have
yet).

Crypto: ECDH (P-256) key agreement per pair + AES-GCM for the message
content. Message routing is still by internal id, not username — the relay
only ever forwards `{iv, ciphertext}` blobs by recipient id and cannot
decrypt anything. Both the message queue (for offline recipients) and the
username directory are in-memory only and reset if the relay restarts;
clients silently re-claim their username on reconnect, but anyone who
hasn't reconnected yet is briefly unfindable until they do (no DB in this
project, consistent with everything else here).

**Run it:**

```bash
npm run dev:all       # runs `next dev` and the relay together
# or separately:
npm run dev
npm run chat-server
```

**Test it with two identities** — open two browser profiles (or one normal +
one incognito window) at http://localhost:3000/chat; each gets its own
identity since it's stored in that browser's localStorage. Pick a username
on each, add each other's username as a contact, then message between them.
To test across two actual devices on the same wifi, use the `Network:` URL
`next dev` prints (e.g. `http://192.168.x.x:3000`) instead of `localhost` on
both — reaching it over mobile data (not on the same LAN) would need a public
tunnel or deployment, which is out of scope here.

## What maps to what in the PRD/TRD

| PRD/TRD concept | Where |
|---|---|
| AI concierge home, quick actions, conversational follow-up | `components/ChatPanel.tsx` |
| Voice interaction (FR-AI-002) | `components/VoiceOverlay.tsx` |
| Manual marketplace (`AI \| Explore \| Activity \| Payments \| Profile`) | `components/BottomNav.tsx`, `app/*` |
| Service Registry / shared catalog | `lib/data/catalog.ts` (AI and Explore both read this) |
| Typed, read-only AI tool contracts | `lib/ai/tools.ts` |
| "Search/compare/recommend: no confirmation; purchase: authorization required" | `lib/store/useAppStore.ts` (`createDraft` vs `authorizeTransaction`), `app/activity/page.tsx` |
| Transaction state machines (order/booking/ride lifecycles) | `useAppStore` `LIFECYCLES`, "Simulate next step" on Activity |
| Saved cards ("never store raw payment credentials", TRD §6.2) + order history / ledger | `app/wallet/page.tsx`, `lib/payments.ts` |
| Profile / Preferences / Memory with view/edit/delete/disable | `app/profile/page.tsx` |
| Auditable AI action trail | `useAppStore.logAudit`, audit panel on Profile |
| Direct messages (not in the original PRD — added on request) | `app/chat/*`, `lib/chat/crypto.ts`, `server/chat-relay.mjs` |

## Known gaps (intentionally out of scope for this slice)

This is the "web demo" scope from the TRD's phasing, not Phase 1. No real
identity/auth, no vendor/partner/admin apps, no payment gateway, no DB —
see `AI_Native_Super_App_TRD.pdf` §2.2 and §30 for what a real Phase 1
build adds on top of this.
