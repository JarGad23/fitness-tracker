# Fitness Tracker — Handoff / Project Status

> Single source of truth for picking up this project. Read this top-to-bottom before changing anything.
> **Last updated:** 2026-09-29 — day notes (tags + text) and the AI API for the local coach

---

## 1. What this is

Personal fitness app: a **weekly pool** of training goals. The user logs any activity on any day; the goal is to "clear" the weekly target per activity (e.g. Siłownia 4×, Bieganie 3×, Rower 3×, Basen 2×).

- **Owner:** Jarek (jaroslaw.gad.krypto@gmail.com — git author)
- **UI language:** Polish (all user-facing text). Code/docs in English.
- **Week:** Monday–Sunday (`weekStartsOn: 1` in date-fns, `pl` locale).
- **Status:** Feature-rich beyond MVP. Builds clean on macOS, lint + typecheck clean. See §8 for what's left.

---

## 2. Stack

Next.js 16.2.x (App Router, **Cache Components / PPR enabled**), React 19, Tailwind 4, **Base UI** (`@base-ui/react`, shadcn "base-nova" style — NOT Radix), Drizzle ORM + **Turso** (libSQL/SQLite edge), NextAuth v5 (Credentials, JWT 30d), Plus Jakarta Sans. Extra libs: `react-day-picker` (calendar), `sonner` (toasts), `lucide-react` (icons), `date-fns`.

---

## 3. Environment

Development machine: **macOS (Apple Silicon)**, Node 26, npm 11. The old Windows/WSL constraints (shared `node_modules`, no builds from WSL, pure-JS-only tooling) are **gone** — everything runs natively: `npm run dev`, `npm run build`, `tsx`, `drizzle-kit`.

- `npm run dev` → Turbopack. `next.config.ts` has `turbopack: {}` because the Serwist wrapper adds a webpack config and Next 16 otherwise refuses to start dev. Serwist is disabled in dev.
- `npm run build` → **`next build --webpack` on purpose**: Serwist injects the service worker (`public/sw.js`) through a webpack plugin; Turbopack builds skip it and the PWA silently loses its SW. Moving to `@serwist/turbopack` would lift this.
- npm 11 blocks dependency install scripts by default (`npm install-scripts ls`). Nothing in this project needs them so far.
- `.gitattributes` (`* text=auto eol=lf`) keeps line endings LF.
- `next start` serves the last `next build`; source changes need a rebuild.
- Testing the webhook against the real DB: prefer `?dry=1`; for real writes use a throwaway user and delete it afterwards (all tables cascade from `users`).

---

## 4. Secrets

- `.env` (gitignored) holds `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `AUTH_SECRET`, `WATCH_SYNC_SECRET`, `AI_API_SECRET`. **Never commit or paste real values** (they leaked once via HANDOFF.md and were rotated; history was rewritten + force-pushed).
- For deploy: also set `AUTH_URL` to the real origin. `AUTH_SECRET` can be regenerated with `openssl rand -base64 32` (logs everyone out, harmless).
- `WATCH_SYNC_SECRET` — bearer token for `POST /api/watch-sync` (Apple Shortcuts). Generate with `openssl rand -hex 32`. **Must be set on Vercel too**, otherwise the webhook returns 500 `Server misconfigured`.
- `AI_API_SECRET` — bearer token for `/api/ai/*` (local AI coach). Separate from `WATCH_SYNC_SECRET` on purpose: a leaked token opens one client's route only. Same generation, same "set it on Vercel" rule. Both checks go through `checkBearer()` in `src/lib/api-auth.ts`.

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
- Passwords: bcryptjs (pure JS) at `BCRYPT_ROUNDS = 10`; older cost-12 hashes are rewritten on the next successful login. Registration signs the user in directly.
- Auth forms use `onSubmit` (not `<form action>`, which resets fields after a failed login) plus `method="post"` as a pre-hydration guard.
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
| Local AI coach API (contract in §8) | `src/app/api/ai/context/route.ts`, `src/app/api/ai/reports/route.ts`, `src/lib/ai-context.ts` (pure JSON builder), `src/components/coach-report.tsx` |
| Bearer auth for machine clients | `src/lib/api-auth.ts` |
| Day notes: tags, editor, actions | `src/lib/day-notes.ts`, `src/components/day-note-editor.tsx`, `src/actions/day-notes.ts` |
| Health payload parsing (v2 shortcut) | `src/lib/health-sync.ts` |
| Shortcut generator (macOS, signs with `shortcuts sign`) | `scripts/shortcuts/generate-watch-sync.py` — live one ("Watch Sync v3"): `--email <account> --hr-source "Apple Watch (Jarosław)" --name "Watch Sync v3"`. Swimming is off by default: a Health type with no samples at all shows a blocking "no samples found" alert that would stall the background automation. |
| Auth config / route protection | `src/lib/auth.ts`, `src/proxy.ts` |
| Auth screens (split: showcase + form) | `src/app/(auth)/layout.tsx`, `src/components/auth-showcase.tsx`, `login-form.tsx`, `(auth)/register/page.tsx`, `password-input.tsx` |
| Gym: workout page (sets editor) | `src/app/(app)/trening/[id]/page.tsx`, `src/components/workout-sets.tsx` |
| Gym: exercise history | `src/app/(app)/cwiczenie/[id]/page.tsx` |
| Gym: actions / helpers / dashboard prompt | `src/actions/gym.ts`, `src/lib/gym.ts`, `src/components/gym-prompts.tsx` |
| DB schema | `src/lib/db/schema.ts` |

---

## 7. Database

Turso (libSQL). Eight tables.

- **users**: id, email, password_hash, created_at
- **activity_types**: id, user_id→users, name, target_per_week, icon (lucide name), **color (hex, nullable)**, **health_kind** (`cycling` | `swimming` | `running` = auto-created from watch signals; `strength` = gym: sets logging + dashboard confirm prompt; null = manual), sort_order, created_at
- **workouts**: id, user_id→users, activity_type_id→activity_types, date (ISO "YYYY-MM-DD"), notes (nullable), **duration (nullable, range code e.g. "45-60")**, **feeling_score (nullable, 1–5 self-rating)**, created_at
- **health_metrics**: id, user_id→users, date (ISO), active_calories, resting_hr, sleep_hours, notes, created_at — all metrics nullable. Fed by `/api/watch-sync`. Also exercise_minutes, cycling_km, swimming_m, running_speed_kmh, and `gym_prompt_dismissed` (user answered "Nie" to the gym prompt for that day; the webhook upsert never touches it). **Unique index on (user_id, date)**: one row per user per day, and the webhook upserts (`onConflictDoUpdate`) so a re-sent day overwrites instead of piling up rows. Duplicates here are silent — averages over identical rows look correct — so the constraint is the only thing that catches it.

- **exercises**: id, user_id→users, name, created_at. Unique on (user_id, lower(name)) — SQLite `lower()` folds ASCII only, so the Polish case-insensitive match ("Łydki" = "ŁYDKI") is done in `addExercise` via `exerciseKey()`.
- **workout_sets**: id, workout_id→workouts (cascade), exercise_id→exercises (cascade), position, reps, weight_kg (null = bodyweight, shown as "MC"), created_at. Exercise order in a workout = min(position) of its sets. Set ids are generated on the client (validated as UUID) so an optimistic set can be edited before the insert returns.
- **coach_reports**: id, user_id→users (cascade), body (Markdown), model, period_start/period_end (ISO, nullable), targets (JSON `[{ name, targetPerWeek }]`, names stored in the user's spelling), applied_at (null = not applied), created_at. Index (user_id, created_at). Written only by `POST /api/ai/reports`; `applied_at` set by the "Zastosuj cele" action.
- **day_notes**: id, user_id→users (cascade), date, tags (JSON array of keys from `DAY_TAGS`, stored in list order), text (≤ 500, nullable), created_at, updated_at. **Unique (user_id, date)**; a note with no tags and no text is deleted, never stored empty. Separate from `health_metrics.notes` on purpose: that row belongs to the webhook upsert, and a note must exist on days without watch data.

Migrations in `drizzle/`: `0000` (initial), `0001` (workouts.duration), `0002` (activity_types.color), `0003` (health_metrics + workouts.feeling_score), `0004` (health_metrics unique index), `0005` (watch workout signals, `workouts.source`, `activity_types.health_kind`), `0006` (gym: `exercises`, `workout_sets`, `gym_prompt_dismissed`, Siłownia → `strength`), `0007` (`coach_reports`), `0008` (`day_notes`). **All are applied to the live DB** — verified by querying it, not by trusting the notes.

**Migrations run through drizzle now:** `npm run db:generate` → review the SQL → `npm run db:migrate`. `__drizzle_migrations` was baselined on 2026-09-25 (all earlier migrations had been applied by hand); drizzle applies every journal entry whose `when` is newer than the last row there.

Handy pattern for one-off DB checks (run from the project root so `node_modules` resolves):

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

**Gym phase (2026-09-26):**
- Modal: picking a `strength` activity turns "Dodaj" into "Rozpocznij trening" → creates the workout and opens `/trening/[id]`. The day list links to the sets page.
- `/trening/[id]`: exercises as cards, sets with +/- (2.5 kg / 1 rep) or typed values, "+ Seria" copies the last set, a new exercise starts from its last-ever set. Every change saves immediately (Server Action + `useOptimistic`). An empty workout offers "Powtórz ostatni trening" (copies all sets of the previous strength session).
- `/cwiczenie/[id]`: sessions (kg×reps) + best set.
- Dashboard: days of the shown week with ≥ `GYM_PROMPT_MIN_MINUTES` (30) exercise minutes, no workout at all and no "Nie" answer get "N min ćwiczeń — to była siłownia?". "Tak" creates a `source = "watch"` gym workout and opens it.
- Cache tag `gym` for set data; set mutations call `updateTag("gym")`.

**AI API for the local coach (2026-09-29):** the app only exposes a contract; the model runs on the Mac (separate project). Bearer `AI_API_SECRET`.
- Mac side (2026-09-30): LM Studio at `http://127.0.0.1:1234/v1` (OpenAI-compatible). Model comparison on a synthetic context lives in `~/Projects/Hobby/coach-lab/` — pick for the coach: `google/gemma-4-26b-a4b`. Read its README gotchas first (`max_tokens`, `reasoning_effort: "none"`, Polish quotes breaking JSON).
- `GET /api/ai/context?user_email=…&weeks=4&today=YYYY-MM-DD` → JSON `version: 1`: `activities`, `weeks[]` (Mon–Sun, oldest first, `current` flag; per-activity done/target/feeling_avg and health averages — computed server-side because small models are bad at arithmetic), `workouts[]` (strength ones with `exercises[].sets[]`), `health_days[]`, `latest_report` (`applied` flag). `weeks` 1–12; pass `today` from the Mac (Vercel is UTC).
- `POST /api/ai/reports` `{ user_email, report (Markdown ≤ 20k), model?, period_start?, period_end?, targets?: [{ name, target_per_week }] }` → 201 `{ id }`. Every problem is a 4xx with a JSON reason: an invalid target entry or an unknown activity name → 422 (with `unknown` + `known` names) so the model can retry. Targets are never applied by the API.
- `/ai-coach` shows the latest report above the Gemini export: body as plain text (no Markdown renderer), current → proposed targets, "Zastosuj cele" (`applyReportTargets`, one-shot: sets `applied_at`). Cache tag `coach-reports`.
- The paste flow now reports unmatched activity names too (warning toast) — the silent skip from the old known gap is gone.

**Day notes (2026-09-29):** context the data can't show (fever, a first mountain hike).
- Quick tags (`DAY_TAGS` in `src/lib/day-notes.ts`: keys stored, Polish labels shown — only append, never remove a key) + optional text.
- Entered in the "Jak minął dzień?" card on the dashboard (today in `Europe/Warsaw`, via `todayISO()`) and in the day modal (any day). Calendar shows a small notebook icon on days with a note.
- `DayNoteEditor`: tags save on tap, text 800 ms after typing stops and on blur; saves are queued; server data is adopted only when idle and the text isn't mid-edit. A date outside the page's loaded range is fetched first (`loadDayNote`) so a save can't overwrite a note it never saw.
- AI: `/api/ai/context` gets `day_notes`, `day_tag_legend` and per-week `day_tags` counts (additive, still `version: 1`); the Gemini export lists "Notatki dnia" per week and the prompt tells the coach to use them to explain outliers.

```bash
curl -H "Authorization: Bearer $AI_API_SECRET" "https://<host>/api/ai/context?user_email=<email>&weeks=4&today=$(date +%F)"
curl -X POST -H "Authorization: Bearer $AI_API_SECRET" -H 'Content-Type: application/json' \
  -d '{"user_email":"<email>","model":"<name>","report":"## Ocena\n…","targets":[{"name":"Siłownia","target_per_week":3}]}' \
  https://<host>/api/ai/reports
```

### Verified for real (not just `tsc`)
- Webhook: 401 on a bad token, 200 + `{"success":true}` on a good one, upsert proven by firing twice → 1 row, `id`/`created_at` unchanged. Now repeatable with `curl` + `?dry=1` (no DB write).
- `parseAITargets` exercised against a raw JSON reply, a report-plus-fenced-block reply, a reply with a decoy code fence before the JSON, and garbage (throws).
- Live DB schema confirmed by querying it directly.
- Gym phase end-to-end on a throwaway user (details in `tasks/todo.md` Review), incl. 390 px layout and the webhook dry run.

### TODO / next steps
1. **Deploy to Vercel** — set `AUTH_URL`, `WATCH_SYNC_SECRET` **and `AI_API_SECRET`** (without them the matching routes 500).
2. **Apple Shortcuts — "Watch Sync v2"** (2026-09-25, verified against the Health app on real data). The shortcut does no math: it sends the last 7 days as text lines and the server aggregates (`src/lib/health-sync.ts`). Payload: `{ version: 2, user_email, today, active_calories: "YYYY-MM-DD;kcal\n…" (grouped by day), resting_hr: "YYYY-MM-DD;bpm\n…" (raw, averaged per day), sleep: "start;end;stage\n…" (raw, overlapping intervals merged, "Czuwanie"/"W łóżku" skipped, night assigned to wake-up day) }`. Every run re-sends the week, so missed runs self-heal and today's partial values get overwritten next day. `?dry=1` parses without writing; `WATCH_SYNC_DEBUG=1` logs the raw payload. The v1 single-day payload `{ date, active_calories, resting_hr, sleep_hours, user_email }` still works; non-positive values are stored as null.
   - **Shortcuts date-filter gotcha:** in the `.wflow` plist, `Start Date` operator `1002` means **"is today"** (the Number is ignored) and `1001` + `Unit 16` means **"in the last N days"**. The v1 shortcut used `1002` believing it was "last 7 days" — that's why it only ever sent morning calories.
   - Shortcuts **cannot read workouts**. Instead the payload carries workout-only signals (`cycling_km`, `swimming_m`, `running_speed`, plus `exercise_minutes`), stored per day in `health_metrics`. `detectWorkouts()` creates a `workouts` row with `source = "watch"` for the activity whose `activity_types.health_kind` matches — only when that day's signal **first crosses its threshold**, and only if the day has no workout of that activity yet. So re-sending the week never duplicates, and a workout the user deletes never comes back. Gym has no workout-only signal and stays manual.
3. **Still unverified by a human:** feeling-score stars (save + reload on edit), and the full Gemini round-trip. Health data so far is **mock** (620 kcal / 54 bpm / 7.5 h) from the test script.
4. ~~Known gap: renamed activities skipped silently~~ — fixed 2026-09-29 (paste flow warns, API returns 422).
5. **Known issue (pre-existing):** a JWT session outlives its user — after deleting a user, a browser still logged in as them sees an empty dashboard instead of being logged out (seen while testing with throwaway users). Low risk for a single-user app; fix = check the user exists in the `jwt`/`session` callback.
6. The AI's advice is only as good as the data — the export needs real logged workouts to be worth anything.

---

## 9. Working agreement (user preferences)
- Verification scales with risk (see the global CLAUDE.md table); UI changes get a look in the browser.
- No emojis in UI. Plain, normal CSS where improvements are needed.
- Token-efficient, direct action. Plan non-trivial work before building.
