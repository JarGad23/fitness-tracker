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

### React form actions reset the form
**Avoid:** `<form action={clientFn}>` for forms that can fail (login). React 19 resets an action form after the action finishes, so a wrong password wiped the email and password.
**Better:** `onSubmit` + `preventDefault` + `new FormData(e.currentTarget)`, with `method="post"` on the form so a pre-hydration Enter never puts the password in the URL. Wrap the action and the following `router.replace` in one `startTransition` so the pending state lasts until the page changes; don't add `router.refresh()` after a push (it is a second request).

### Timing in a background Chrome tab is quantized to 1 s
**Avoid:** Measuring UI latency with `setTimeout` polling in a tab the automation drives. The tab is in the background, timers clamp to ~1 s, and every run "took" 1000 ms. `requestAnimationFrame` never fires there at all (the script hung).
**Better:** Wait with `MutationObserver` and read `performance.getEntriesByType("resource")`; cross-check with server-side timings. Measure in a production build (`next build` + `next start`), not dev.

### Claude-in-Chrome clicks can silently miss
**Avoid:** Retrying coordinate clicks/typing when nothing happens. After a window resize attempt, clicks on "Wyloguj" and keystrokes into inputs stopped landing (no request, no error) while the page was fine.
**Better:** After one miss, check the DOM (`document.activeElement`, input values) and drive the flow through JS (`el.click()`, native value setter + `input` event + `form.requestSubmit()`), which still goes through the real handlers.

### Mobile-width checks when the window won't resize
**Avoid:** Retrying `resize_window` — it reported success while `innerWidth` stayed 1728 px.
**Better:** Check `innerWidth` right after resizing. If it didn't change, load the page in a
same-origin `<iframe style="width:390px">`, then measure `contentDocument.documentElement.scrollWidth`
and card rects, and zoom-screenshot the iframe region.

### Autosaving editors vs server refresh
**Avoid:** Syncing an editor's local state from server props on every change. After
`updateTag`, the refreshed prop reflects the *first* save while later taps/typing are
still local → they get wiped. Reading state in a handler (`tags.includes`) also goes stale
when several events fire before a re-render.
**Better:** Adopt server data only when no save is pending and the text isn't dirty;
queue saves; keep the latest values in a ref updated in handlers. Don't rely on blur
alone to save text on mobile — debounce it.

### Focus events don't fire in a background automation tab
**Avoid:** Testing blur-to-save with `el.focus()` / `el.blur()` from Claude-in-Chrome —
`document.hasFocus()` is false, no focus events fire, and it looks like the save is broken.
**Better:** Dispatch `new FocusEvent('focusout', { bubbles: true })` (what React's
`onBlur` listens to), and wait for streamed sections by polling for a specific selector
(`textarea[aria-label=…]`), not a generic card lookup.

### Throwaway users leave a live session behind
**Avoid:** Deleting a throwaway user while the browser is still logged in as them. The JWT
outlives the user (HANDOFF known issue), so the next `/register` silently redirects to `/`
and the "new" user is never created — seeding then fails with no row.
**Better:** Click "Wyloguj" before deleting a test user. Seed rows *before* the first page
load or restart `npm run dev` afterwards — direct DB inserts don't invalidate `"use cache"` tags.

### Measure latency before naming a cause
**Avoid:** Telling Jarek a 400–500 ms server action was "mostly the session check" without
measuring. `auth()` with JWT only decrypts a cookie. The real causes were Vercel functions in
`iad1` while Turso is in `eu-west-1`, plus `Promise.all` on libsql (a second connection:
146 ms for two `select 1` vs 51 ms batched, 48 ms per sequential query from the Mac).
**Better:** Time each step (`performance.now()` around queries, `x-vercel-id` for the function
region) before explaining slowness. Keep the function region next to the DB.

### `npm run build` leaves a service worker that poisons dev
**Avoid:** Blaming a hydration mismatch on HMR and restarting dev. After `npm run build`,
`public/sw.js` (Serwist) gets served by `next dev` too; once registered it serves cached JS
chunks, so the browser runs old client code against a fresh server render. A restart doesn't help.
**Better:** When a mismatch diff shows the *client* side as the old code, check
`navigator.serviceWorker.getRegistrations()` + `caches.keys()` first; unregister and clear
before testing in dev after a production build.

### drizzle-kit drops FK actions on ALTER TABLE ADD (SQLite)
**Avoid:** Trusting generated SQL for a new FK column — `references(..., { onDelete: "set null" })`
came out as a bare `REFERENCES plan_days(id)`.
**Better:** Read every generated migration; add the `ON DELETE …` by hand before `db:migrate`.


### CardHeader is a grid — header rows need `min-w-0`
**Avoid:** A `flex justify-between` row (title + truncating subtitle + button) placed directly in
`CardHeader`. The base-nova `CardHeader` is a CSS grid; its child keeps `min-width: auto`, so a
long `truncate` subtitle widened the row and pushed the "Nowy raport" button out of the card at
390 px (desktop looked fine).
**Better:** Put `min-w-0` on the row wrapper *and* the text column inside `CardHeader`. After
adding a button to a header, measure the button vs. the card's right edge at 390 px.

### AI context must say when the plan started
**Avoid:** Giving the model the current plan plus 8 weeks of sessions without dates for the plan.
The first report judged a 05.10 session "off-plan", though the plan only started on 14.10.
**Better:** Every context fact with a validity window carries it (`Obowiązuje od …`). Run the
dry run on real data and read the output before wiring the UI.

### Gemini structured output: a bare 400 means "bisect the schema"
**Avoid:** Guessing at the cause of `400 Request contains an invalid argument` and shipping a
speculative fix (I first rewrote every nullable `anyOf` into `type: [X, "null"]` — no effect).
The real cause was `maxItems` (Zod `.max()`) on an array of 11-field objects; the same
keyword on a simple array is fine, and every field alone was fine.
**Better:** Bisect with real calls: each field alone, then fields cumulatively, then top-level
keywords. Revert any fix the bisect didn't prove. Enforce counts like "max 8 items" in code
after `safeParse`, not in the schema sent to Gemini.

### Records that describe a change must snapshot the "before"
**Avoid:** Rendering an applied plan change by looking up its target in the *current* plan —
after "Wyciskanie sztangi → hantle" was applied, the card read "hantle → hantle".
**Better:** Store the target's state with the proposal (`PlanChange.before`) and render from
it; use the live data only to decide whether a pending change still applies.

### A test that "applies" must also test what the change does to its neighbours
**Avoid:** Checking only that a plan change lands. Replacing a plank (seconds) with Face pull
kept "45–60" as reps, and Face pull ended up twice in day B — both looked like success.
**Better:** After applying, read the whole day back. Guard unit switches without a new range
and same-day duplicates both in validation and in the apply action.
