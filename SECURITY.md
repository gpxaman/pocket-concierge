# Security Policy

Pocket Concierge is a demo application (no real database, payment
provider, or user accounts — see the README's "Known gaps" section), but
it does handle a few genuinely security-relevant things: end-to-end
encrypted chat, WebRTC calls, and a server-side AI tool-use loop. If you
find a real vulnerability in any of those, please report it responsibly.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Instead, use GitHub's private reporting:
[Report a vulnerability](https://github.com/gpxaman/pocket-concierge/security/advisories/new)
via this repository's Security tab.

Include, if possible:

- A description of the vulnerability and its potential impact
- Steps to reproduce it
- Any relevant logs, screenshots, or proof-of-concept code

You should get an acknowledgment within a few days. This is a
community-maintained demo project without a dedicated security team, so
response times may vary — thank you for your patience.

## Scope

In scope:

- The Next.js app (`app/`, `components/`, `lib/`)
- The chat relay server (`server/chat-relay.mjs`)
- The end-to-end encryption implementation (`lib/chat/crypto.ts`)

Out of scope (already documented as known, intentional limitations for a
demo — see the README):

- Lack of real authentication/identity verification
- Private keys persisted in `localStorage` rather than a hardware-backed
  keystore
- No rate limiting, abuse prevention, or production-grade infrastructure
  hardening
