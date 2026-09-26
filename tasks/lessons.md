# Lessons

### "tsc czysty" is NOT verification of a feature
**Avoid:** Marking a feature done because `tsc --noEmit` and eslint pass. The AI Coach session shipped a webhook where `updateTag()` threw on every single request — Next.js only rejects it at runtime (`revalidate.js`: `if (workStore.page.endsWith('/route')) throw`). The signature is valid, so types looked perfect while the endpoint was 100% broken.
**Better:** Any code path with a runtime contract (Next.js cache APIs, DB writes, auth) must be exercised for real before calling it done. Run the server locally and hit the path (webhook: `?dry=1`, or a throwaway user for real writes). State plainly that types passing ≠ it works.

### updateTag vs revalidateTag in Next.js 16
**Avoid:** `updateTag(tag)` anywhere outside a Server Action. In Route Handlers it always throws `E872`, which surfaces as a bare 500 with no JSON body.
**Better:** Server Actions → `updateTag(tag)`. Route Handlers → `revalidateTag(tag, "max")` (second arg required, else a deprecation warning is logged).

### Handoff docs drift — verify claims against reality
**Avoid:** Trusting `SESSION-HANDOFF.md` / `todo.md` on state. Real examples: claimed "WATCH_SYNC_SECRET is already in .env" (it wasn't), claimed "nothing is committed" (it was, as `c7ca2cc`), left "apply migration 0003" unchecked (it had been applied).
**Better:** Check the ground truth first — `git log`, `grep` the .env keys, query Turso directly. Run node scripts from the project root so `node_modules` resolves; `node --env-file=.env script.mjs` avoids needing dotenv.

### Shortcut .wflow parameters don't mean what they look like
**Avoid:** Reading a Shortcuts plist and trusting its apparent meaning. `Start Date, Operator 1002, Number 7, Unit 16` looks like "last 7 days" but is "is today" — the number is ignored. The v1 shortcut shipped with it and only ever sent morning calories; days of trial and error never caught it because nothing showed what the phone actually sent.
**Better:** Make the phone's output observable first: `?dry=1` on the webhook plus `WATCH_SYNC_DEBUG=1` on a local `next start` reachable over LAN, then read the raw payload from the server log. Change the shortcut only after seeing real data. Known codes: `1001` + `Unit 16` = last N days, `1002` = today.

### Shortcuts loops don't scale linearly
**Avoid:** Scaling a shortcut's window from a measured small run (7 days of sleep ≈ 200 samples, 3 s) to 90 days (≈ 2700 samples) assuming linear time. The 90-day backfill hung on the phone for 15+ minutes and never sent anything.
**Better:** Keep per-sample loops small (raw sleep ≤ ~14 days). For long history use day-grouped quantities (one iteration per day). Grow windows in steps and time each run.

### Plan edits must reach every mention
**Avoid:** Changing a threshold in the plan body after a correction but leaving the Context section describing the old number ("≥ 40"). Jarek saw 40 at the top and had to correct it twice.
**Better:** After a correction, grep the whole plan for the old value and rewrite the Context line to state the decision explicitly ("Próg: ≥ 30 min — decyzja Jarka").

### Drizzle relational queries rewrite raw sql column refs
**Avoid:** `` sql`exists (select 1 from ${workoutSets} where ${workoutSets.workoutId} = ${workouts.id})` `` inside `db.query.workouts.findFirst({ where })`. Drizzle renders every column in the raw fragment against the root table alias → `workouts.workout_id` → `no such column` at runtime. `tsc` is clean.
**Better:** In relational-query `where`, use subquery builders: `inArray(workouts.id, db.selectDistinct({ id: workoutSets.workoutId }).from(workoutSets))`. Raw `sql` with other tables' columns is fine in core `db.select()` queries.
