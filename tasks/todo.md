# Goal-less activities + sleep format (2026-10-06)

Jarek wanted an "Inna" option in the day modal for a hike/zoo walk. Target 0 = "bez celu":
loggable everywhere, never in the weekly pool.

- [x] Settings + actions accept 0–14; list and form preview say "bez celu"
- [x] Dashboard "Ukończono" and history count only goal activities; progress bars skip them
- [x] "Inna" (target 0, Activity icon, violet) in DEFAULT_ACTIVITIES for new accounts
- [ ] Insert "Inna" for Jarek's account after the deploy is live (old code divides by 0)
- [x] Sleep tile: "6 h 48 min" instead of "6,8 h"
- [x] Verify: tsc, lint, throwaway user: Inna logged → 0/12, run → 1/12, 4 bars, calendar,
      settings "bez celu", edit to 0 works; user logged out + deleted

# Day modal redesign (2026-10-06)

Jarek thought a day note needed one of the 4 activities picked ("Dodaj" disabled) — the
note always autosaved, but sat inside the workout form. Modal also felt cramped.

- [x] Header = full date + small date-picker trigger; bottom "Zamknij" removed (X closes)
- [x] Watch strip: sen / tętno spocz. / ruch / kalorie from `health_metrics` (month-grid range)
- [x] Left column: activities + "Jak minął dzień?" ("Zapisuje się samo…"); right: workout form
      with its own submit; phones: form behind "+ Dodaj trening", auto-opens on edit
- [x] Verify: tsc, lint; throwaway user desktop + 390 px: note saves with no activity picked
      and reloads, add collapses the form, edit opens it, no horizontal scroll; user deleted

# Gym prompt fixes (2026-10-06)

Found on real data: hike/zoo days answered "Nie" lost the info; "Tak" felt slow; an empty
workout page was a lone input.

- [x] "Nie" → "Co to było?" (Zapisz / Pomiń); the answer merges into the day note
      (tag `extra_activity` + text appended, existing note kept); only for days with a watch row
- [x] "Tak": `confirmGymPrompt` redirects from the action (one round trip); spinner until the
      page lands; `unstable_rethrow` keeps the redirect error out of the toast
- [x] Empty workout: "Dodaj pierwsze ćwiczenie" card; recent exercises as one-tap chips (max 6)
- [x] Verify: tsc, lint, throwaway user at 390 px (iframe), user deleted afterwards

## Review
- Merge checked in the DB: `["poor_sleep","extra_activity"]`, "Stara notatka\nWyprawa w góry".
- "Tak": one fetch (the action), no second navigation request, no toast.
- Direct DB inserts don't invalidate `"use cache"` tags — restart dev before testing seeded rows.

# Day notes — tags + text, sent to the AI

Decisions (2026-09-29): quick tags + optional text; "Dziś" card on the dashboard + day
modal for earlier days; calendar dot; notes in the local AI API and the Gemini export.

- [x] Migration 0008: `day_notes` (unique user+date)
- [x] `src/lib/day-notes.ts` (tags), actions, query
- [x] `DayNoteEditor` (chips save at once, text on blur, loads unknown dates)
- [x] Dashboard "Dziś" card, calendar dot, modal section
- [x] AI context + Gemini export
- [x] Verify: tsc, lint, build, throwaway user, desktop + 390 px, modal flows re-clicked
- [x] HANDOFF

## Review
- Bugs found only by clicking, all fixed: (1) a tap followed by typing lost tags/text —
  the server refresh after the first save overwrote local state, and handlers read stale
  `tags`; (2) text saved only on blur, so closing the phone app mid-note would lose it
  while the status said "Zapisano" → autosave after 800 ms, no "Zapisano" while dirty;
  (3) mobile note icon covered the day number → moved under it.
- Verified on a throwaway user (deleted, cascade checked): taps + typing → DB exact;
  reload keeps it; clearing a note deletes the row and its calendar icon; a date picked
  outside the month (10.08) loads its old note instead of wiping it; editing today in the
  modal updates the dashboard card; add/delete workout in the modal still works; API
  `day_notes` / `day_tags` / legend; Gemini export lists the note. Desktop + 390 px
  (iframe): no horizontal scroll, cards and modal don't overlap.
- Also: the workout note field in the modal is now "Notatka do aktywności" (two note
  fields in one modal were ambiguous); `/api/ai/context` default `today` uses Polish time.
- Found, not fixed: JWT outlives a deleted user (HANDOFF §8).

---

# AI API — context out, report in

Decisions (2026-09-29): read + report write, separate `AI_API_SECRET`, latest report on
`/ai-coach` with "Zastosuj cele". The local model itself is a separate project.

- [x] Migration 0007: `coach_reports`
- [x] `src/lib/api-auth.ts` (bearer check shared with watch-sync)
- [x] `normalizeTargets` + `applyTargets` (skipped names reported)
- [x] `buildAIContext` + queries
- [x] `GET /api/ai/context`, `POST /api/ai/reports`
- [x] Report card on `/ai-coach` + `applyReportTargets`
- [x] Verify: tsc, lint, build, curl, Chrome 390 px + desktop, throwaway user deleted
- [x] HANDOFF

## Review
- Verified on `next start` (prod build) with a temporary `AI_API_SECRET` passed in the
  process env (`.env` untouched): GET 401/400/404/200; aggregates for 21–27.09 on the real
  account match a direct SQL query (4× gym, 624 kcal, 57 bpm, 6.5 h, 245 min).
- POST on a throwaway user (deleted, cascade checked): 401, invalid JSON, missing report,
  bad period, invalid target, partly invalid list, unknown name (422 + known names), 201.
- Found in the browser, not in curl: a target sent as "siłownia" was stored and shown
  lowercase → the route now stores the user's spelling.
- UI: desktop + 390 px (same-origin iframe, window resize didn't apply): no horizontal
  scroll, cards don't overlap, long words wrap. "Zastosuj cele" → toast, button disabled,
  dashboard Siłownia 1/4, context `applied: true`. watch-sync still 401 / 200 (dry) after
  moving the bearer check to `src/lib/api-auth.ts`.
- Resting HR 88/93 bpm on 28–29.09 (vs 52–64) is real, not a sync bug: Jarek had a fever,
  ~5 h sleep and a first long mountain hike on 28.09.
- Needs Jarek: add `AI_API_SECRET` to `.env` and Vercel, deploy.

---

# Auth screens — redesign + speed

Report (2026-09-27): login feels laggy, ~0.5 s pause after Enter "as if two requests",
fields wiped after a wrong password, plain design.

- [x] Causes measured: bcryptjs cost 12 = 190 ms (pure JS); first Turso query on a cold
      connection ~570 ms; `router.push` + `router.refresh()` = a second dashboard request;
      `<form action>` resets the form after the action; three large `blur-3xl` layers
- [x] bcrypt cost 10 (`BCRYPT_ROUNDS`), cost-12 hashes rewritten on the next login
- [x] onSubmit + `method="post"` (fields survive errors; no password in the URL if Enter
      lands before hydration); one transition over action + navigation; no refresh
- [x] Register signs in directly (no retyping on the login screen)
- [x] Split layout: showcase panel (animated weekly-pool rings) + form; compact rings
      header on mobile; password show/hide; autocomplete attributes
- [x] Verified on a throwaway user (deleted): wrong password keeps both fields, register
      → dashboard, cost-12 hash → `$2b$10$` after login; prod build Enter → dashboard
      190–234 ms warm / 600 ms cold (was ~550 ms for the action alone + extra request);
      390 px without horizontal scroll

---

# Gym phase — sets logging, repeat last, watch prompt, exercise history

Decisions (2026-09-26): relational tables, dedicated workout page, gym prompt at >= 30
exercise minutes (short sessions happen). AI data contract is a separate phase.

- [x] Migration 0006: `exercises`, `workout_sets`, `health_metrics.gym_prompt_dismissed`,
      Siłownia → `health_kind = 'strength'` (backup `.backups/db-2026-09-26.json`, verified on live DB)
- [x] Register seed + watch-sync only auto-creates `AUTO_DETECTED_KINDS`
- [x] Queries (`gym` tag) + actions (`src/actions/gym.ts`)
- [x] `/trening/[id]` — exercises, sets with +/-, "+ Seria", instant save (useOptimistic,
      client-generated set ids), "Powtórz ostatni trening" on an empty workout
- [x] Modal: "Rozpocznij trening" for strength → workout page; sets link on the day list
- [x] Dashboard prompt "N min ćwiczeń — to była siłownia?" Tak / Nie
- [x] `/cwiczenie/[id]` — sessions table + best set
- [x] E2E on a throwaway user (deleted), 390 px + desktop, `npm run build`
- [x] HANDOFF §5–§8

## Review (gym phase)
- "Repeat last" moved from the modal to the empty workout page: it works the same after
  a watch confirm, and the modal doesn't need set history.
- E2E: prompts at 30 / 46 min shown, 29 min and a bike day not; "Nie" persists across
  reload; "Tak" creates a `watch` gym workout and opens it; 4 fast +2.5 taps = 10 kg;
  "62,5" typed saves; "ŁYDKI" joins "Łydki" (no duplicate exercise); repeat copies all
  sets; history shows both sessions + record; deleting the workout cascades its sets;
  watch-sync dry run detects the bike and never auto-creates a gym workout.
- Bug found only at runtime: raw `sql` inside a relational `findFirst` gets its column
  refs rewritten to the root table alias (see lessons.md). `tsc` was clean.
- Known behaviour: deleting a gym workout created from a prompt brings the prompt back
  for that day (minutes still there, no workout, never answered "Nie").
- Next: AI data contract (separate phase); maybe duration/feeling on the workout page.

---

# Watch Sync v2 — "dumb shortcut, smart server"

Context (2026-09-25): old shortcut sends today's date with partial-morning calories,
unclear resting HR, sleep that can double-count "In Bed" and writes 0 when the watch
wasn't worn. Shortcuts cannot read workouts directly.

## Server
- [x] `src/lib/health-sync.ts` — pure parsers: per-day lines (`date;value`), sleep samples
      (`start;end;label`) → per-night hours (merge overlapping intervals, skip awake/in-bed)
- [x] `/api/watch-sync` accepts v2 payload (7 days at once), keeps v1 working
- [x] v1: `sleep_hours: 0` → null
- [x] `?dry=1` → parse + report, no DB write (debugging from the shortcut)
- [x] Response reports what was saved per day + unknown sleep labels
- [x] Verify: parser script on sample data, curl against local server (dry run)

## Shortcut
- [x] Generate "Watch Sync v2" from real action structures of the existing shortcuts
- [x] Sign with `shortcuts sign`, import on Mac → syncs to iPhone
- [x] Jarek runs it manually on iPhone, pastes the response
- [x] Switch automation (now to v3)

## Later
- [x] Workout detection from workout-only samples (cycling/swimming distance, running speed)
  - [x] Backup DB → `.backups/db-2026-09-25.json` (gitignored)
  - [x] Baseline `__drizzle_migrations` (5 rows, sha256 + journal `when`); `db:migrate` = no-op
  - [x] Migration 0005: health_metrics exercise/cycling/swimming/running columns,
        `workouts.source`, `activity_types.health_kind` (set from names) — applied
  - [x] `detectWorkouts`: create a workout only when a day's signal first crosses its
        threshold; skip days that already have that activity; deleted ones never return
  - [x] E2E on a throwaway user: dry run, create, manual blocks duplicate, resend = no-op,
        deleted stays deleted
  - [x] Exact Health type names from a "Typy" shortcut built on the phone:
        Cycling Distance, Swimming Distance, Running Speed, Running Power, Exercise Time
  - [x] Swimming dropped from the daily shortcut (never recorded → blocking alert)
  - [x] Deployed; backfill (90 days, cycling only): 26 rides created, 4 manual untouched
  - [x] "Watch Sync v3" live in the 11:00 automation; first run verified in the DB
- [x] Phase 0 cleanup: `turbopack: {}` fixes `npm run dev`; WSL/Windows rules removed from CLAUDE.md / HANDOFF.md / lessons.md; obsolete `scripts/test-watch-sync.ps1` and `scripts/migrate.ts` deleted; `__drizzle_migrations` baseline documented as a prerequisite for the next migration

## Review
- Old shortcut bug found: date filter operator 1002 = "is today", not "last 7 days" → only
  morning calories were ever sent. v2 uses 1001 (last N days), copied from the Sen shortcut.
- Real phone run (dry): 8 days of calories/resting HR, 5 nights of sleep (4-day window; final uses 7), ~3 s runtime.
  Checked vs Health app for 24.09: sleep 5h47 vs 5h48, kcal 589 vs 587 (rounding).
- DB write path tested on a temporary user (batch upsert, partial re-send keeps values,
  v1 sleep 0 → null), user deleted afterwards.
- Found on the way: `npm run dev` fails (Serwist webpack config vs default Turbopack) → Phase 0.
- Shortcut generator lives in the session scratchpad (built from the exported originals).
- Production live (bcf4083, 0f1c156). Backfill: 90 days of calories + resting HR, 14 nights
  of sleep → 91 days in DB (27.06–25.09), zero morning-only calories left. 55 days have no
  sleep (older than the 14-day sleep window and never sent by v1). 90-day sleep loop hung
  the phone — see lessons.md.
