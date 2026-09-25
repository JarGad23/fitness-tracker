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
- [ ] Switch automation to v2 once the numbers match the Health app

## Later
- [ ] Workout detection from workout-only samples (cycling/swimming distance, running speed)
  - [x] Backup DB → `.backups/db-2026-09-25.json` (gitignored)
  - [x] Baseline `__drizzle_migrations` (5 rows, sha256 + journal `when`); `db:migrate` = no-op
  - [x] Migration 0005: health_metrics exercise/cycling/swimming/running columns,
        `workouts.source`, `activity_types.health_kind` (set from names) — applied
  - [x] `detectWorkouts`: create a workout only when a day's signal first crosses its
        threshold; skip days that already have that activity; deleted ones never return
  - [x] E2E on a throwaway user: dry run, create, manual blocks duplicate, resend = no-op,
        deleted stays deleted
  - [ ] Exact Health type names (Jarek exports a "Typy" shortcut) → generator
  - [ ] Deploy, new shortcut, 90-day backfill, check calendar
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
