# Architecture

This document is for contributors: how the codebase is laid out, why the
two zustand stores are split the way they are, and how to add a new domain
without recreating the "one 1000-line file" problem this structure was
built to get out of.

## Folder layout

```
app/                      Next.js App Router routes — pages stay thin, delegating to components/lib
  api/ai/chat/route.ts     SSE endpoint: POST handler + provider fallback order only
components/
  <Feature>.tsx            Route-level components that compose smaller pieces below
  payments/                PaymentsPanel's sub-sections (WalletCard, SavedCards, OrderHistory)
  profile/                 Profile page's accordion sections (one file per section)
  chat/                    Chat page's pieces (StoriesRow, StoryViewer, NoteComposer, ContactList)
  home/                    HomeAgent's extractable pieces (Transcript, VoicePickerSheet)
  rides/                   RideTrackingView's pieces (OtpEntry, RideMap)
lib/
  types/                   Barrel of domain types, split by area (catalog, transactions, chat, rides, ...)
  data/catalog/            Barrel of the product catalog, split by category
  store/useAppStore/       The main app store, as zustand "slices"
  store/useChatStore/      The chat/calling store, as zustand "slices"
  ai/
    providers/             One file per LLM provider (anthropic, gemini, openrouter) + shared.ts
    systemPrompt.ts         Prompt text + per-request context injection
    grounding.ts             Reply-correctness logic (never trust the model's own claim that it acted)
  rides/                   Pure ride math (geometry.ts) + the matching/auto-advance hooks
  home/                    Pure text helpers extracted from HomeAgent (renderInline, cutSentences)
  chat/crypto.ts           E2E encryption (ECDH + AES-GCM)
e2e/                       Playwright specs
server/                    The chat relay (WebSocket signaling — never sees plaintext)
```

**Barrel-file rule**: `lib/types`, `lib/data/catalog`, `lib/store/useAppStore`
and `lib/store/useChatStore` are all *folders* with an `index.ts` that
re-exports everything the equivalent single file used to. Every consumer
still imports via `@/lib/types`, `@/lib/store/useAppStore`, etc. — nothing
outside these folders needs to know they're split internally.

## Why zustand "slices" for the two stores

`useAppStore` and `useChatStore` are each still *one* store — one `create()`
call, one persisted blob — because plenty of logic genuinely spans
"domains" (e.g. `authorizeTransaction` reads wallet balance and payment
methods; the chat connection slice's relay-message router touches identity,
contacts, messaging and calls). Splitting into separate stores would have
meant threading data between them for every cross-cutting action.

Instead, each domain (cart, wallet, transactions, rides, ... / identity,
contacts, messaging, calls, ...) is a `slices/xSlice.ts` file exporting a
`createXSlice: StateCreator<FullState, [], [], XSliceInterface>` — a plain
function of `(set, get, api) => ({ ...initial state, ...actions })`. The
store's `index.ts` combines them by object-spreading each one inside a
single `create<FullState>()(persist((...a) => ({...s1(...a), ...s2(...a)}), ...))`
call. Because every slice is handed the *same* `set`/`get` (scoped to the
whole combined state, not just its own slice), cross-slice reads inside an
action are exactly as trivial as they were in one big file — `get().walletBalance`
works from any slice. Only the *files* are reorganized, not the runtime
access pattern.

**Where to find shared per-store logic**: each store's `types.ts` holds
every slice interface plus the combined state type (kept in one file, not
distributed — slices need the combined type for their `StateCreator`
generic, and the combined type needs every slice's interface, so splitting
this file would create a circular import). `helpers.ts` (useAppStore) and
`internal.ts` (useChatStore) hold cross-slice helper *functions* — not
closures — that take `set`/`get` as explicit parameters instead of
capturing them, so any slice can call them and so they're independently
unit-testable with a mock `set`/`get` (see `lib/store/useChatStore/messaging.integration.test.ts`).

`useChatStore` additionally has `transport.ts`: non-serializable, genuinely
process-wide state (the WebSocket, the RTCPeerConnection, MediaStreams, the
ICE candidate buffer) that doesn't belong to any one domain slice and can't
be persisted anyway.

## Adding a new domain

1. **New types?** Add a file under `lib/types/` and re-export it from
   `lib/types/index.ts`.
2. **New store state/actions that belong together?** Add
   `lib/store/useAppStore/slices/yourSlice.ts` (or the chat store's
   equivalent), add its interface to that store's `types.ts`, intersect it
   into the combined state type, and spread `createYourSlice(...a)` into
   `index.ts`'s `create()` call.
3. **New route-level UI getting large?** Pull self-contained sections into
   sibling files under `components/<feature>/`, the same way
   `PaymentsPanel.tsx` → `components/payments/*` was done — each extracted
   piece should be able to read whatever store state it needs itself
   (`useAppStore((s) => s.foo)`) rather than being handed everything as
   props, unless it's a modal/sheet whose open/close state genuinely has to
   live in the parent.
4. **Write the test alongside the code it covers**, not in a separate
   mirror tree: `lib/foo.ts` → `lib/foo.test.ts` in the same folder. This is
   why `lib/rides/geometry.test.ts` sits next to `lib/rides/geometry.ts`
   instead of under a top-level `tests/`.

## Testing

Three tiers, matching what each one is good at catching:

- **Unit** (`*.test.ts[x]`, run via `npm run test`): pure functions with no
  store/DOM dependency — pricing math, card validation, loyalty tiers, ride
  marker geometry, the catalog's cart-mutation rule, real ECDH+AES-GCM
  round-trip encryption.
- **Integration** (`*.integration.test.ts`, same `npm run test` run): the
  real store (not a mock), exercising an action that spans multiple slices
  — e.g. `createDraft` → `authorizeTransaction` → `advanceTransaction`
  across TransactionsSlice/WalletSlice/AuditSlice, or a simulated incoming
  encrypted relay message decrypting correctly and updating unread counts.
  These catch the exact class of bug a slice split could introduce: two
  slices silently ending up with different `set`/`get`.
- **E2E** (`e2e/*.spec.ts`, run via `npm run test:e2e`, Playwright): real
  browser(s) against the real dev server + chat relay — a full manual
  checkout, two browser contexts pairing over chat and exchanging a
  message, two contexts completing a WebRTC call with fake media devices.
  Deliberately avoids depending on a configured AI provider API key so it
  stays runnable in CI with zero secrets.

Run everything: `npm run test && npm run test:e2e` (the latter needs
`npx playwright install chromium` once, and needs the OS package
dependencies Playwright's installer normally installs via `--with-deps` in
environments where that's not blocked by sandboxing).
