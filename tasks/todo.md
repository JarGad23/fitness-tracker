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
- [ ] Phase 0 cleanup: stale WSL rules in CLAUDE.md / HANDOFF.md / lessons.md

## Review
- Old shortcut bug found: date filter operator 1002 = "is today", not "last 7 days" → only
  morning calories were ever sent. v2 uses 1001 (last N days), copied from the Sen shortcut.
- Real phone run (dry): 8 days of calories/resting HR, 5 nights of sleep (4-day window; final uses 7), ~3 s runtime.
  Checked vs Health app for 24.09: sleep 5h47 vs 5h48, kcal 589 vs 587 (rounding).
- DB write path tested on a temporary user (batch upsert, partial re-send keeps values,
  v1 sleep 0 → null), user deleted afterwards.
- Found on the way: `npm run dev` fails (Serwist webpack config vs default Turbopack) → Phase 0.
- Shortcut generator lives in the session scratchpad (built from the exported originals).
