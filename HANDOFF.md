# Fitness Tracker — Handoff / Project Status

> Single source of truth for picking up this project. Read this top-to-bottom before changing anything.
> **Last updated:** 2026-06-17 (Claude Opus 4.8)

---

## 1. What this is

Personal fitness app: a **weekly pool** of training goals. The user logs any activity on any day; the goal is to "clear" the weekly target per activity (e.g. Siłownia 4×, Bieganie 3×, Rower 3×, Basen 2×).

- **Owner:** Jarek (jaroslaw.gad.krypto@gmail.com — git author)
- **UI language:** Polish (all user-facing text). Code/docs in English.
- **Week:** Monday–Sunday (`weekStartsOn: 1` in date-fns, `pl` locale).
- **Status:** Feature-rich beyond MVP. Builds clean on Windows, lint + typecheck clean. See §8 for what's left.

---

## 2. Stack

Next.js 16.2.x (App Router, **Cache Components / PPR enabled**), React 19, Tailwind 4, **Base UI** (`@base-ui/react`, shadcn "base-nova" style — NOT Radix), Drizzle ORM + **Turso** (libSQL/SQLite edge), NextAuth v5 (Credentials, JWT 30d), Plus Jakarta Sans. Extra libs: `react-day-picker` (calendar), `sonner` (toasts), `lucide-react` (icons), `date-fns`.

---

## 3. ⚠️ Environment — READ FIRST (this is the #1 source of pain)

The repo lives on a **Windows path** (`/mnt/c/...`) and is used from **both Windows and WSL**. `node_modules` is shared.

- **NEVER run `npm install` from WSL.** Native binaries are platform-gated; an install in WSL prunes the Windows binaries (`@next/swc-win32`, `lightningcss-win32`, `@tailwindcss/oxide-win32`) and breaks the user's `npm run build`. (It already happened once.) The reverse is also true.
- **NEVER run `next build` / `next dev` from WSL.** It writes a Linux-owned `.next/`, which then fails on Windows with `EPERM: unlink ...`. If it happens, delete `.next` and rebuild on Windows.
- **The user builds & runs on Windows** (`npm run build && npm start`, or `npm run dev`).
- **From WSL, verify with pure-JS tools only:** `npm run lint` (ESLint) and `npx tsc --noEmit` (typecheck). Both work without native binaries and catch most issues (including bad Base UI / react-day-picker API usage and missing lucide icon names).
- **DB migrations from WSL:** use the fetch-based client `@libsql/client/web` (no native binary). Example pattern used this session: read `.env`, `createClient({url, authToken})`, run `ALTER TABLE ...`. The native `@libsql/client` will NOT load in WSL.
- `.gitattributes` (`* text=auto eol=lf`) is committed — keeps line endings LF on both OSes. Without it, Windows CRLF makes every file look fully rewritten.
- `next start` serves the last `next build`; source changes need a rebuild to show up (not a bug).

---

## 4. Secrets

- `.env` (gitignored) holds `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `AUTH_SECRET`, `WATCH_SYNC_SECRET`. **Never commit or paste real values** (they leaked once via HANDOFF.md and were rotated; history was rewritten + force-pushed).
- For deploy: also set `AUTH_URL` to the real origin. `AUTH_SECRET` can be regenerated with `openssl rand -base64 32` (logs everyone out, harmless).
- `WATCH_SYNC_SECRET` — bearer token for `POST /api/watch-sync` (Apple Shortcuts). Generate with `openssl rand -hex 32`. **Must be set on Vercel too**, otherwise the webhook returns 500 `Server misconfigured`.

---

## 5. Architecture & key decisions (the non-obvious stuff)

### Caching — Cache Components + PPR (`cacheComponents: true` in `next.config.ts`)
- Cached reads live in `src/lib/queries.ts` (`getCachedActivityTypes(userId)`, `getCachedWorkoutsInRange(userId, start, end)`) and use **plain `"use cache"`** with **`userId` passed as an argument** (so it's part of the cache key).
- **Auth is read OUTSIDE the cache:** each dynamic Suspense child calls `await auth()` to get `userId`, then calls the cached query. This is the Vercel-preferred pattern.
- **Do NOT use `"use cache: private"`** — it's experimental, browser-memory-only, "not for production." We migrated off it.
- **Do NOT use `"use cache: remote"`** for per-user data — near-zero hit rate; docs say fetch user data from source. Reserve `remote` for a future shared/expensive query (e.g. cross-user aggregate), where it's a one-line swap.
- **Long `cacheLife` stale is intentional and safe** because every mutation calls `updateTag("workouts" | "activity-types" | "health-metrics")`, invalidating immediately. (activity-types → `cacheLife("days")`, workouts / health-metrics → `cacheLife("hours")`.)
- **⚠️ `updateTag` throws outside a Server Action.** Next.js 16 checks `workStore.page.endsWith('/route')` and throws `E872`, which surfaces as a **bare 500 with no JSON body** — it looks like a DB failure, not a cache bug. Server Actions → `updateTag(tag)`. Route Handlers → `revalidateTag(tag, "max")` (the 2nd arg is required, else a deprecation warning is logged). This bit us in `/api/watch-sync`: `tsc` was clean while every request 500'd. A bare 4xx/5xx **with no JSON body** never came from our code.
- **PPR layout pattern:** pages render a static shell (card frames, titles) and wrap each data region in its own `<Suspense>` with a skeleton. See `src/app/(app)/page.tsx`, `historia/page.tsx`, `ustawienia/page.tsx`. Sections each call `auth()` + cached queries; same-key queries dedupe within a request.
- **No React Query.** It would duplicate `use cache`/PPR and move fetching client-side. For optimistic UI use React 19 `useOptimistic`. Revisit only for offline-PWA sync / polling / heavy client filtering.
- **In dev, skeletons show on every navigation** (dev disables the client Router Cache); in a prod build, revisits are instant — this is expected, not a bug.

### Routing / middleware
- `src/proxy.ts` (Next 16 convention) replaces `middleware.ts`. It's the NextAuth `auth()` wrapper that redirects unauthenticated users to `/login` and authed users away from `/login`,`/register`.
- `src/lib/auth.ts` has **`trustHost: true`** — required for `next start`/self-hosting (Auth.js only auto-trusts host in dev).

### Per-activity colors & icons (customizable)
- Each `activity_types` row has a **`color` hex** (e.g. `#22c55e`). Runtime hex can't be a static Tailwind class, so we use **inline styles**:
  - `src/lib/activity-colors.ts`: `resolveActivityColor(activity)` → hex (falls back to name-based defaults then gray); `activityColorStyles(hex)` → `{ solid, soft (10% tint), text, border }` style objects; `COLOR_PRESETS`.
- **Icons:** `src/lib/activity-icons.ts` is the shared set (`ACTIVITY_ICONS`, `getActivityIcon(name)`, and `activityIconElement(name, props)` which uses `createElement` to avoid the `react-hooks/static-components` lint error at render top-level). Use `activityIconElement` when assigning at a component's render top level; `const Icon = getActivityIcon(...)` is fine *inside* `.map` callbacks.
- These render everywhere an activity appears: calendar pills/dots, weekly progress, add-activity modal, settings list.

### UI primitives (Base UI based — not Radix)
- Custom wrappers in `src/components/ui/`: `popover.tsx`, `calendar.tsx` (react-day-picker v10, fully Tailwind-styled, `pl` locale), `select.tsx` (Base UI Select), `sonner.tsx` (`<Toaster richColors />`, mounted in root `layout.tsx`), `textarea.tsx`. Dialog/Button/Input/etc. were already Base UI.

---

## 6. Key files

| Area | File |
|------|------|
| Dashboard (PPR shell + sections) | `src/app/(app)/page.tsx` |
| Month/week calendar + day modal trigger | `src/components/calendar-view.tsx` |
| Add/delete workout modal (date picker, duration, notes, toasts) | `src/components/add-activity-modal.tsx` |
| Weekly progress bars | `src/components/weekly-progress.tsx` |
| Week navigation + jump-to-week picker | `src/components/week-navigation.tsx` |
| Settings (icon + color pickers, live preview) | `src/components/settings-content.tsx`, `icon-picker.tsx`, `color-picker.tsx` |
| Cached queries | `src/lib/queries.ts` |
| Colors / icons helpers | `src/lib/activity-colors.ts`, `src/lib/activity-icons.ts` |
| Server actions | `src/actions/workouts.ts`, `activity-types.ts`, `auth.ts`, `ai-sync.ts` |
| AI Coach export/import (pure fns) | `src/lib/ai-sync.ts` (`buildCoachMarkdown`, `parseAITargets`) |
| AI Coach page + UI | `src/app/(app)/ai-coach/page.tsx`, `src/components/ai-coach-content.tsx` |
| Apple Watch webhook | `src/app/api/watch-sync/route.ts` |
| Webhook test script (Windows) | `scripts/test-watch-sync.ps1` |
| Auth config / route protection | `src/lib/auth.ts`, `src/proxy.ts` |
| Auth screens (shared bg + card) | `src/app/(auth)/layout.tsx`, `src/components/auth-card.tsx` |
| DB schema | `src/lib/db/schema.ts` |

---

## 7. Database

Turso (libSQL). Four tables.

- **users**: id, email, password_hash, created_at
- **activity_types**: id, user_id→users, name, target_per_week, icon (lucide name), **color (hex, nullable)**, sort_order, created_at
- **workouts**: id, user_id→users, activity_type_id→activity_types, date (ISO "YYYY-MM-DD"), notes (nullable), **duration (nullable, range code e.g. "45-60")**, **feeling_score (nullable, 1–5 self-rating)**, created_at
- **health_metrics**: id, user_id→users, date (ISO), active_calories, resting_hr, sleep_hours, notes, created_at — all metrics nullable. Fed by `/api/watch-sync`. **Unique index on (user_id, date)**: one row per user per day, and the webhook upserts (`onConflictDoUpdate`) so a re-sent day overwrites instead of piling up rows. Duplicates here are silent — averages over identical rows look correct — so the constraint is the only thing that catches it.

Migrations in `drizzle/`: `0000` (initial), `0001` (workouts.duration), `0002` (activity_types.color), `0003` (health_metrics + workouts.feeling_score), `0004` (health_metrics unique index). **All are applied to the live DB** — verified by querying it, not by trusting the notes.

**Writing migrations:** `drizzle-kit generate` **does not run in WSL** (needs the Windows-native esbuild binary). `0003` and `0004` were therefore hand-written: the `.sql`, plus `meta/000N_snapshot.json` (copy the previous snapshot, set `prevId` to the old `id`, give it a fresh `id`, apply the diff) and an entry in `meta/_journal.json`. Apply them from WSL with `@libsql/client/web` — pure JS, works. Handy pattern for one-off DB checks/scripts (must run from the project root so `node_modules` resolves; `tsx` is broken in WSL for the same esbuild reason):

```bash
# ./tmp.mjs  →  node --env-file=.env ./tmp.mjs
import { createClient } from "@libsql/client/web";
const client = createClient({ url: process.env.DATABASE_URL, authToken: process.env.DATABASE_AUTH_TOKEN });
console.log((await client.execute("PRAGMA index_list(health_metrics)")).rows);
```

---

## 8. What's done vs. what's next

### Done (see `git log`)
Core tracker (dashboard, month calendar, week nav, history, settings with icon/color pickers); Cache Components/PPR; duration, notes, edit workout; PWA icons + Serwist SW + goal confetti; login/register toasts + shared auth layout/card.

**AI Coach + Apple Watch (branch `feat/ai-coach-and-improvments`):**
- `/ai-coach` exports the previous + current week as Markdown → paste into Gemini → paste its reply back to update `target_per_week`. Matching is **by activity name, case-insensitive**.
- `workouts.feeling_score` (1–5 stars in the add/edit modal), surfaced in the export as a per-activity average.
- `POST /api/watch-sync` — bearer-token webhook for Apple Shortcuts, upserts into `health_metrics`.

### Verified for real (not just `tsc`)
- Webhook: 401 on a bad token, 200 + `{"success":true}` on a good one, upsert proven by firing twice → 1 row, `id`/`created_at` unchanged. Repeat with `scripts/test-watch-sync.ps1`.
- `parseAITargets` exercised against a raw JSON reply, a report-plus-fenced-block reply, a reply with a decoy code fence before the JSON, and garbage (throws).
- Live DB schema confirmed by querying it directly.

### TODO / next steps
1. **Deploy to Vercel** — set `AUTH_URL` **and `WATCH_SYNC_SECRET`** (without it the webhook 500s).
2. **Apple Shortcuts** (needs the public URL): "Get contents of URL", POST, header `Authorization: Bearer <secret>`, JSON body `{ date, active_calories, resting_hr, sleep_hours, user_email }`. `date` must be ISO `YYYY-MM-DD`; `/ai-coach` only renders the current + previous week, so an out-of-range date saves but appears nowhere.
3. **Still unverified by a human:** feeling-score stars (save + reload on edit), and the full Gemini round-trip. Health data so far is **mock** (620 kcal / 54 bpm / 7.5 h) from the test script.
4. **Known gap:** if the AI renames an activity ("Siłownia" → "Gym"), `syncAITargets` **skips it silently** and still reports success. The prompt warns against it; the code doesn't report unmatched names. Fix = return skipped names from the action and show them in the UI.
5. The AI's advice is only as good as the data — the export needs real logged workouts to be worth anything.

---

## 9. Working agreement (user preferences)
- Don't run build/lint/tests after every edit; the user verifies on Windows. (Lint/tsc from WSL only when useful.)
- No emojis in UI. Plain, normal CSS where improvements are needed.
- Token-efficient, direct action. Plan non-trivial work before building.
