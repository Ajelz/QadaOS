# QadaOS

Track the prayers you owe, the ones you pray today, and a plan to close the gap. Switch plans as often as you like. The math never breaks.

QadaOS is an installable web app (PWA) for Muslims making up missed prayers (qada). It keeps one ledger for two things that move the same number in opposite directions: qada you complete, and daily prayers you miss going forward. On top of the ledger sit switchable catch-up strategies that generate daily targets and a projected finish date without ever touching the recorded facts.

- **Append-only ledger.** Every action is an immutable event. Debt, targets, adherence and projections are derived. Undo is itself an event.
- **Pending, never auto-missed.** A daily prayer whose window closes without a log becomes pending. You resolve it. Nothing inflates silently.
- **Composable strategies with history.** "Two Fajr with Fajr, three more at night, then move down the order." Every switch closes a period and opens a new one, each with its own adherence report.
- **Local-first, synced.** Works fully offline. Changes queue and sync when online. Two devices on one account converge.
- **No streaks, no guilt.** Progress and pace only. Missing a day is a fact in the ledger, not a broken chain.
- **Fiqh is configuration.** Calculation method, Asr rule, Witr tracking and the Isha boundary are settings with neutral defaults. QadaOS takes no position.

## Stack

Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind 4, Drizzle + Postgres (Neon), better-auth (Google + passkeys), Dexie (IndexedDB), adhan (prayer times), Serwist (service worker), web-push. Tests: vitest for the domain and store, Playwright for end-to-end.

The domain package in `src/domain` is pure TypeScript with zero React or database imports. The UI never computes debt, windows or targets; it only calls the domain.

## Run it locally

Requirements: Node 24 (see `.nvmrc`).

```bash
npm install --legacy-peer-deps
cp .env.example .env
# Fill in .env, or leave it and run with auth optional (below)
npm run dev
```

Without a database or Google credentials you can still run the whole UI:

```bash
NEXT_PUBLIC_AUTH_OPTIONAL=true npm run dev
```

Sync will fail quietly and the app keeps working on this device. Never set that variable in production.

```bash
npm test          # domain + store unit tests
npm run test:e2e  # Playwright smoke suite (starts its own dev server)
npm run typecheck
npm run lint
npm run build     # next build, then serwist build → public/sw.js
```

## Self-host on Vercel

1. Fork this repo and import it into Vercel.
2. **Database.** Add Neon from the Vercel Marketplace, or point `DATABASE_URL` at any Postgres. Run `npm run db:migrate` once against it (or `npx drizzle-kit migrate`).
3. **Google sign-in.** In Google Cloud Console create an OAuth client of type Web. Add `https://<your-domain>/api/auth/callback/google` as an authorised redirect URI (and `http://localhost:3000/api/auth/callback/google` for local dev). Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
4. **Auth secret.** `BETTER_AUTH_SECRET` from `openssl rand -base64 32`, and `BETTER_AUTH_URL` set to your public origin with no trailing slash.
5. **Push.** `npx web-push generate-vapid-keys`, then set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` and `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (same value as the public key).
6. **Reminder scheduler.** Set `REMINDER_DISPATCH_SECRET`. Then schedule a POST to `https://<your-domain>/api/reminders/dispatch` every 5 minutes with header `Authorization: Bearer <secret>`. Vercel's Hobby plan runs crons once a day, so use Upstash QStash from the Marketplace, or a Vercel cron on Pro. The endpoint is idempotent, so overlapping runs are safe.
7. Deploy. Open the URL on your phone and add it to the Home Screen. On iPhone, reminders only work when installed.

All variables are listed in `.env.example`.

## Data model in one paragraph

Seven event types: `debt.set_initial`, `debt.adjust`, `qada.logged`, `daily.resolved` (on time, late, missed, exempt), `strategy.started`, `strategy.stopped`, `event.revoked`. Events carry a client-generated UUID, so sync is a set union: the client pushes its outbox, the server inserts with `ON CONFLICT DO NOTHING` and assigns a monotonic `server_seq`, the client pulls everything after its cursor. The reducer sorts by `(occurredAt, id)` so every device reaches the same state.

## Privacy

Prayer data is sensitive. The hosted instance stores only what the ledger needs, never sells or shares it, has no analytics, and deletes everything immediately on request. See `/privacy` in the app.

## Spec

The full specification, decisions and deviations live in `docs/specs/2026-09-19-qadaos-v1.md`.

## License

MIT.
