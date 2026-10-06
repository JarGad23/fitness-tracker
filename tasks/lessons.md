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
