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
- **Visual language is law**: cream ground, 2.5px ink borders, hard offset shadows, flat role colours (coral now/primary, yellow pending, teal done, violet plan, sky stats), Archivo heavy. Tokens in `src/app/globals.css`; classes `brut`, `brut-sm`, `pressable`, `display`, `num`.
- Fiqh-sensitive behaviour is always a setting with a neutral default.

## Commands

Use Node 24 (`.nvmrc`). Install with `npm install --legacy-peer-deps` (npm 10.8 crashes on this peer set otherwise).

- `npm run dev`; `NEXT_PUBLIC_AUTH_OPTIONAL=true npm run dev` to skip Google locally (never in prod).
- `npm test` (vitest, `src/**/*.test.ts`), `npm run test:e2e` (Playwright, starts its own dev server on 3100, writes `e2e/screenshots/`).
- `npm run typecheck`, `npm run lint`, `npm run build` (`next build && serwist build serwist.config.ts`).
- `npm run db:generate` / `npm run db:migrate` (needs `DATABASE_URL`).

## Gotchas

- adhan reads the process-local calendar fields of the Date it is given; `prayerDay.ts` builds a local-noon Date for the target day on purpose.
- Serwist runs in configurator mode (`serwist.config.ts`) because its webpack plugin does not work under Turbopack. `public/sw.js` is generated and gitignored.
- zod 4: nested object defaults use `.prefault({})`, not `.default({})`.
- iOS delivers Web Push only to home-screen installs; `pushClient.isIosNotInstalled()` gates the UI.
- Vercel Hobby crons run daily; reminders need an external 5-minute schedule (QStash) hitting `/api/reminders/dispatch` with the bearer secret.
