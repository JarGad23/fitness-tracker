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
