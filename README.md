# Pocket Concierge — AI concierge demo

A working slice of the AI-Native Super App PRD/TRD: an AI-first home,
a mock shared service catalog (electronics, food, grocery, fashion, hotels,
rides, services), a manual Explore marketplace over the *same* catalog, and
a draft → explicit-authorization → lifecycle transaction flow (PRD §8) with
saved cards, an order-history ledger, and an AI action audit trail (TRD §23.3).

There is no real backend, database or payment provider — state lives in
the browser (`localStorage` via zustand) so the whole thing runs with just
`npm install && npm run dev`.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## AI mode

By default there's no `ANTHROPIC_API_KEY`, so `/api/ai/chat` uses a small
rule-based fallback agent (`lib/ai/fallback.ts`) — enough to try every
category end to end with zero config.

For the real reasoning concierge (Claude with a tool-use loop over
`search_catalog` / `get_item` / `present_recommendations`, see
`app/api/ai/chat/route.ts`), copy `.env.example` to `.env.local` and set:

```
ANTHROPIC_API_KEY=sk-ant-...
```

## What maps to what in the PRD/TRD

| PRD/TRD concept | Where |
|---|---|
| AI concierge home, quick actions, conversational follow-up | `components/ChatPanel.tsx` |
| Manual marketplace (`AI \| Explore \| Activity \| Payments \| Profile`) | `components/BottomNav.tsx`, `app/*` |
| Service Registry / shared catalog | `lib/data/catalog.ts` (AI and Explore both read this) |
| Typed, read-only AI tool contracts | `lib/ai/tools.ts` |
| "Search/compare/recommend: no confirmation; purchase: authorization required" | `lib/store/useAppStore.ts` (`createDraft` vs `authorizeTransaction`), `app/activity/page.tsx` |
| Transaction state machines (order/booking/ride lifecycles) | `useAppStore` `LIFECYCLES`, "Simulate next step" on Activity |
| Saved cards ("never store raw payment credentials", TRD §6.2) + order history / ledger | `app/wallet/page.tsx`, `lib/payments.ts` |
| Profile / Preferences / Memory with view/edit/delete/disable | `app/profile/page.tsx` |
| Auditable AI action trail | `useAppStore.logAudit`, audit panel on Profile |

## Known gaps (intentionally out of scope for this slice)

This is the "web demo" scope from the TRD's phasing, not Phase 1. No real
identity/auth, no vendor/partner/admin apps, no payment gateway, no DB —
see `AI_Native_Super_App_TRD.pdf` §2.2 and §30 for what a real Phase 1
build adds on top of this.
