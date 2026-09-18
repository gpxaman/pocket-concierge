# Contributing to Pocket Concierge

Thanks for considering a contribution — this is a demo project, but it's
built and tested like a real one, and PRs are genuinely welcome.

## Getting set up

```bash
git clone https://github.com/gpxaman/pocket-concierge.git
cd pocket-concierge
npm install
cp .env.example .env.local   # optional — the app runs with zero config
npm run dev:all               # web app + chat relay together
```

Open http://localhost:3000. See the [README](./README.md) for what each
feature does and [ARCHITECTURE.md](./ARCHITECTURE.md) for how the codebase
is laid out and why.

## Before opening a PR

Run the full local check — this is exactly what CI runs:

```bash
npm run lint
npx tsc --noEmit
npm run build
npm run test          # unit + integration (Vitest)
npm run test:e2e      # end-to-end (Playwright — run `npx playwright install chromium` once first)
```

If you changed voice, ride, or calling behavior, also do a manual pass in
the browser — Playwright's fake media devices don't fully substitute for a
real mic/camera/speaker, and it's the fastest way to catch something a test
wouldn't.

## Making changes

- **Keep files small and domain-scoped.** If a file you're editing is
  already large and your change would make it larger, consider whether it
  should be split first — see `ARCHITECTURE.md`'s "Adding a new domain"
  section for the pattern this repo follows (zustand slices for store
  logic, small composed components for UI, one file per concern under
  `lib/`).
- **Write the test next to the code it covers**, not in a separate mirror
  tree — `lib/foo.ts` → `lib/foo.test.ts` in the same folder.
- **Comment the "why," not the "what."** Code should be readable enough
  that a comment restating what a line does is redundant. Comments earn
  their place by capturing a non-obvious constraint, a workaround, or the
  reasoning behind a decision that isn't visible from the code alone.
- **Preserve existing import paths where possible.** Several modules
  (`lib/types`, `lib/data/catalog`, `lib/store/useAppStore`,
  `lib/store/useChatStore`) are folders with an `index.ts` barrel
  specifically so every consumer can keep importing from the same path —
  don't break that contract without a good reason and a wider discussion
  first.
- **No unrelated reformatting.** Keep diffs focused on the change you're
  making so they're reviewable.

## Commit messages / PRs

- Keep the PR title short and specific; put details in the description.
- Explain *why* the change is needed, not just what it does — the diff
  already shows what changed.
- Link the issue it closes, if any (`Closes #123`).
- Small, focused PRs get reviewed faster than large ones that bundle
  several unrelated changes.

## Reporting bugs / requesting features

Use the issue templates — they ask for the specific context needed to act
on a report (repro steps, expected vs. actual behavior, browser/OS for
bugs). See [SECURITY.md](./SECURITY.md) instead if what you found is a
security issue.

## Code of Conduct

This project follows the [Contributor Covenant](./CODE_OF_CONDUCT.md).
Participation means agreeing to abide by it.
