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

## Snap (camera + filters)

Tap the "Snap" tab (next to AI in the bottom nav) for a live camera screen
(`app/snap/page.tsx`): pick a filter, tap to capture, and it's saved to a
local gallery. Filters are plain CSS (`brightness/contrast/saturate/hue-
rotate/sepia/grayscale`, see `lib/filters.ts`) applied live to the
`<video>` preview and burned into the still on capture via an offscreen
canvas — no ML, no face tracking, just color grading. Six built-in presets
ship by default; anyone can add their own (see Creator, below).

## Creator registration + custom filters

In Profile, under **Creator**: register a creator handle/category/bio, then
**Create a filter** — a slider editor (`components/FilterEditor.tsx`) with
live preview plus quick presets, saved under a name you pick
(`lib/store/useSnapStore.ts`). Anything you create immediately shows up as
a selectable filter chip on the Snap page, alongside the built-ins.

## Direct messages (E2E encrypted)

Tap the "Chat" tab (next to AI in the bottom nav) to open `/chat`: a real,
working end-to-end encrypted direct-message feature between any two people
running this app — not part of the original PRD, but independent of the AI
concierge's own conversation.

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

## Voice & video calls

Inside a conversation, the phone/video icons next to the contact's name
start a real 1:1 WebRTC call (`lib/chat/webrtc.ts`, call state and
signaling in `lib/store/useChatStore.ts`, UI in
`components/CallOverlay.tsx`, mounted globally so an incoming call reaches
you from anywhere in the app, not just the chat screen). The relay
(`server/chat-relay.mjs`) only passes through SDP offer/answer and trickled
ICE candidates by recipient id — the actual audio/video stream never
touches it; once connected, media flows directly between the two browsers
(via STUN-assisted NAT traversal) and is DTLS-SRTP encrypted by the
browsers' own WebRTC stack, the same as any WebRTC app.

"Highest quality" here means: video requested at up to 1080p30 with a
raised sender bitrate ceiling (~3 Mbps), and audio with echo
cancellation/noise suppression/auto-gain on and a 48kHz stereo-capable
capture — see `VIDEO_CONSTRAINTS`/`AUDIO_CONSTRAINTS`/
`applyHighQualityEncoding` in `lib/chat/webrtc.ts`. Actual delivered
quality still depends on both people's camera/mic and the network path
between them. There's no TURN server configured (only public STUN), so a
call between two networks that both do strict NAT/symmetric firewalling
(common on some corporate wifi) may fail to connect — that's a known gap
for a demo-scope relay, not something client config can fix.

## Rides (Uber/Ola-style) and food delivery (Zomato/DoorDash-style)

Tapping **Rides** or **Food** in Explore skips the generic catalog list for
a dedicated booking flow with live tracking:

- **Rides** (`app/explore/rides/page.tsx`): enter pickup/destination, pick a
  tier (Auto/Mini/Sedan/XL) with a live fare quote (`lib/rides.ts` — a
  deterministic mock distance from the pickup+destination pair, so quoting
  the same route twice gives the same fare, occasionally with a small
  "demand surge" for flavor), request, and it authorizes payment upfront
  through the exact same wallet/card flow as everything else, then hands
  off to a live-tracking screen that auto-progresses through the PRD's own
  ride lifecycle (Searching → Driver Assigned → Arriving → Arrived →
  Started → Completed) with a randomly assigned driver, name/vehicle/plate/
  rating, and a live ETA — then a post-ride star rating.
- **Food** (`app/explore/food/page.tsx`): browse the existing food catalog
  as restaurant cards, order with delivery fee + platform fee shown
  transparently, and track it through the PRD's food lifecycle (Pending
  Vendor → Preparing → Rider Assigned → Picked Up → Delivered) the same way.

Both reuse one shared component, `components/LiveTrackMap.tsx` — an
abstract animated route (no real maps/geocoding API, no key required) with
a marker that eases along a curve as the phase progresses. Both also reuse
the existing `Transaction` lifecycle in `useAppStore` (`advanceTransaction`
is called at the right moments so the ride/order shows up correctly in
Activity and Payments' order history once it completes), rather than
inventing a parallel order-tracking system.

## What maps to what in the PRD/TRD

| PRD/TRD concept | Where |
|---|---|
| AI concierge home, quick actions, conversational follow-up | `components/ChatPanel.tsx` |
| Voice interaction (FR-AI-002) | `components/VoiceOverlay.tsx` |
| Manual marketplace (`AI \| Snap \| Chat \| Explore \| Activity \| Payments \| Profile`) | `components/BottomNav.tsx`, `app/*` |
| Service Registry / shared catalog | `lib/data/catalog.ts` (AI and Explore both read this) |
| Typed, read-only AI tool contracts | `lib/ai/tools.ts` |
| "Search/compare/recommend: no confirmation; purchase: authorization required" | `lib/store/useAppStore.ts` (`createDraft` vs `authorizeTransaction`), `app/activity/page.tsx` |
| Transaction state machines (order/booking/ride lifecycles) | `useAppStore` `LIFECYCLES`, "Simulate next step" on Activity |
| Saved cards ("never store raw payment credentials", TRD §6.2) + order history / ledger | `app/wallet/page.tsx`, `lib/payments.ts` |
| Profile / Preferences / Memory with view/edit/delete/disable | `app/profile/page.tsx` |
| Auditable AI action trail | `useAppStore.logAudit`, audit panel on Profile |
| Direct messages (not in the original PRD — added on request) | `app/chat/*`, `lib/chat/crypto.ts`, `server/chat-relay.mjs` |
| Voice/video calls (not in the original PRD — added on request) | `lib/chat/webrtc.ts`, `components/CallOverlay.tsx` |
| Camera + filters, creator registration (not in the original PRD — added on request) | `app/snap/page.tsx`, `lib/store/useSnapStore.ts`, `components/FilterEditor.tsx` |
| Ride booking + live tracking (PRD's own ride lifecycle, example 14) | `app/explore/rides/page.tsx`, `lib/store/useRideStore.ts`, `lib/rides.ts` |
| Food ordering + live tracking (PRD's own food lifecycle, example 14) | `app/explore/food/page.tsx`, `lib/store/useFoodOrderStore.ts`, `lib/food.ts` |

## Known gaps (intentionally out of scope for this slice)

This is the "web demo" scope from the TRD's phasing, not Phase 1. No real
identity/auth, no vendor/partner/admin apps, no payment gateway, no DB —
see `AI_Native_Super_App_TRD.pdf` §2.2 and §30 for what a real Phase 1
build adds on top of this.
