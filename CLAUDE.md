# QadaOS

Prayer-debt ledger PWA. Read `docs/specs/2026-09-19-qadaos-v1.md` before changing behaviour; its Decisions and Assumptions are binding, and departures go in its Deviations section.

## Layout

- `src/domain/` pure TypeScript, no React, no DB. `ledger.ts` (events + reducer), `prayerDay.ts` (adhan wrapper, Fajr-anchored days, windows, pending), `strategy.ts` (targets, progress, adherence, projections, templates), `reminders.ts` (due selection), `schemas.ts` (zod, shared by client and server), `types.ts`.
- `src/store/` client only. `db.ts` (Dexie), `ledger.ts` (append/revoke), `sync.ts` (outbox syncer, transport-injected), `syncManager.ts` (singleton + `useSyncState`), `settings.ts` (LWW doc), `hooks.ts` (`useLedger`, `useLedgerActions`, `useSettings`), `useSchedule.ts`.
- `src/app/` App Router. `(app)/` tabs behind `AuthGate` + `TabBar`; `onboarding`, `sign-in`, `~offline`, `privacy`; `api/` route handlers; `sw.ts` service worker; `manifest.ts`.
- `src/components/` `ui/` primitives (Card, Button, Chip, ProgressBar, PrayerTile, Sheet, Toast, Sticker, Skeleton), `screens/`, `sheets/`.
- `src/db/schema/` Drizzle: `auth.ts` (better-auth tables), `app.ts` (ledger_events, user_settings, push_subscriptions, reminder_dispatches). Migrations in `drizzle/`.
- `src/lib/` `auth.ts` (better-auth server), `auth-client.ts`, `db.ts`, `env.ts`, `errors.ts`, `session.ts`, `format.ts`, `pushClient.ts`.

## Rules

- **The UI never computes.** Debt, windows, targets and projections come from `src/domain`. If a screen needs a number the domain does not expose, add it to the domain with a test.
- **Events are immutable.** Never edit or delete a ledger row. Corrections are `debt.adjust`; undo is `event.revoked`.
- **Every write goes local first**, then `syncManager.requestSync()`. Route handlers validate with the zod schemas in `src/domain/schemas.ts`.
- **No streaks, badges or celebrations.** Decision 10 of the spec.
- **Visual language is law.** The rules are written at the top of `src/app/globals.css`; read them before touching UI. In short: one border weight (`--bw` 2.5px; 2px only for parts inside a bordered object), two shadows (`--shadow` 4px, `--shadow-sm` 2px), three radii plus pill (`--r-card` 14, `--r-btn` 12, `--r-sm` 8), type scale 11/13/15/17/20/28/44/54 only, Archivo 600 to 900, no opacity tricks (disabled, scrims and tints are flat colours).
- **Colour roles, one meaning each:** coral = current prayer window and THE primary action (every screen, including sign-in and onboarding); yellow = pending and the active tab; teal = prayed, success, debt falling; sky = prayed late and the Stats anchor; violet = plan and strategy; orange = debt owed (the draining bars); grey = exempt, debt rising; hatch = a recorded miss; rust = destructive only; ink = offline and errors. Prayers have no colour of their own. A miss is never coral or red.
- **Every control is at least 44px** in both directions, inputs are 16px text (stops iOS zoom), and pinch zoom stays enabled. `e2e/polish.spec.ts` enforces 44px and no horizontal overflow at 320px.
- **Stickers** sit in the cream only: beside a screen title (the `sticker` slot on `Header`) or in `PageFoot`. Never a pixel offset inside a card stack.
- Fiqh-sensitive behaviour is always a setting with a neutral default.

## Commands

Use Node 24 (`.nvmrc`). Install with `npm install --legacy-peer-deps` (npm 10.8 crashes on this peer set otherwise).

- `npm run dev`; `NEXT_PUBLIC_AUTH_OPTIONAL=true npm run dev` to skip Google locally (never in prod).
- `npm test` (vitest, `src/**/*.test.ts`), `npm run test:e2e` (Playwright, starts its own dev server on 3100, writes `e2e/screenshots/`).
- `npm run typecheck`, `npm run lint`, `npm run build` (`next build && serwist build serwist.config.ts`).
- `npm run db:generate` / `npm run db:migrate` (needs `DATABASE_URL`).

## Gotchas

- **Tailwind cascade.** Custom classes live in `@layer components` so utilities can override them. Two utilities of equal specificity resolve by stylesheet order, not class order, so never pass `bg-*`, `px-*` or a display utility through `className` to fight a component's own: use the component's prop (`tone`, `padded`, `variant`).
- **Never build a Tailwind class name dynamically** (`${bp}:hidden`). Tailwind only generates classes it can see written out in full.
- **Centre with `my-auto`, not `justify-center`,** on full-height pages: when content is taller than the screen, `justify-center` pushes the top out of reach.
- Sheets are portalled to `<body>`, make everything else `inert`, trap focus, and set `body[data-sheet-open]`, which moves toasts to the top so they never cover sheet controls.
- Undo is reversible: an `event.revoked` can itself be revoked, and `state.undone` lists what can be restored. Structural entries (starting debt, adjustments, plan start/stop) ask for confirmation before undo.

- adhan reads the process-local calendar fields of the Date it is given; `prayerDay.ts` builds a local-noon Date for the target day on purpose.
- Serwist runs in configurator mode (`serwist.config.ts`) because its webpack plugin does not work under Turbopack. `public/sw.js` is generated and gitignored.
- zod 4: nested object defaults use `.prefault({})`, not `.default({})`.
- iOS delivers Web Push only to home-screen installs; `pushClient.isIosNotInstalled()` gates the UI.
- Vercel Hobby crons run daily; reminders need an external 5-minute schedule (QStash) hitting `/api/reminders/dispatch` with the bearer secret.
