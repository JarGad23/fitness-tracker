# Lessons

### Never build/install from WSL on this repo
**Avoid:** Running `npm run build`, `next build`, `next dev`, or `npm install` from WSL. The repo lives on `/mnt/c` (Windows) with shared `node_modules`. Builds create a Linux-owned `.next/` that breaks the user's Windows build with `EPERM: unlink`. Installs prune Windows native binaries (`@next/swc-win32`, `lightningcss-win32`, `@tailwindcss/oxide-win32`).
**Better:** From WSL verify with pure-JS tools only — `npm run lint` and `npx tsc --noEmit`. Both catch type/lint errors without native bindings. The user builds & runs on Windows. (Documented in HANDOFF.md §3.)

### Read HANDOFF.md §3 BEFORE touching build/deps
**Avoid:** Assuming a standard build verification flow.
**Better:** This project's HANDOFF.md is the source of truth and has hard environment constraints. Re-read it after any git pull/merge — it may have been updated.

### "tsc czysty" is NOT verification of a feature
**Avoid:** Marking a feature done because `tsc --noEmit` and eslint pass. The AI Coach session shipped a webhook where `updateTag()` threw on every single request — Next.js only rejects it at runtime (`revalidate.js`: `if (workStore.page.endsWith('/route')) throw`). The signature is valid, so types looked perfect while the endpoint was 100% broken.
**Better:** Any code path with a runtime contract (Next.js cache APIs, DB writes, auth) must be exercised for real before calling it done. When WSL can't run the server, write a script the user runs on Windows (`scripts/test-watch-sync.ps1`) and ask for the output. State plainly that types passing ≠ it works.

### updateTag vs revalidateTag in Next.js 16
**Avoid:** `updateTag(tag)` anywhere outside a Server Action. In Route Handlers it always throws `E872`, which surfaces as a bare 500 with no JSON body.
**Better:** Server Actions → `updateTag(tag)`. Route Handlers → `revalidateTag(tag, "max")` (second arg required, else a deprecation warning is logged).

### Handoff docs drift — verify claims against reality
**Avoid:** Trusting `SESSION-HANDOFF.md` / `todo.md` on state. Real examples: claimed "WATCH_SYNC_SECRET is already in .env" (it wasn't), claimed "nothing is committed" (it was, as `c7ca2cc`), left "apply migration 0003" unchecked (it had been applied).
**Better:** Check the ground truth first — `git log`, `grep` the .env keys, query Turso via `@libsql/client/web` (works in WSL; `tsx`/`drizzle-kit` don't — esbuild-win). Run node scripts from the project root so `node_modules` resolves; `node --env-file=.env script.mjs` avoids needing dotenv.

### Windows PowerShell 5.1 mangles pasted multi-line commands
**Avoid:** Giving the user long one-liner `curl.exe` / `Invoke-RestMethod` commands. PS 5.1 pastes line-by-line and breaks the string mid-quote (shows `>>`). A newline inside an `Authorization` header makes Node reject the request with a bare `400 Bad Request` + `Connection: close` and no body — which looks exactly like an app bug and wastes a debugging cycle.
**Better:** Ship a `.ps1` script in `scripts/` and give one short line to run it: `powershell -ExecutionPolicy Bypass -File scripts\name.ps1`. Have the script read secrets from `.env` itself so it can't drift from the server. Tell-tale: a 4xx/5xx with NO JSON body did not come from our route.

### Shortcut .wflow parameters don't mean what they look like
**Avoid:** Reading a Shortcuts plist and trusting its apparent meaning. `Start Date, Operator 1002, Number 7, Unit 16` looks like "last 7 days" but is "is today" — the number is ignored. The v1 shortcut shipped with it and only ever sent morning calories; days of trial and error never caught it because nothing showed what the phone actually sent.
**Better:** Make the phone's output observable first: `?dry=1` on the webhook plus `WATCH_SYNC_DEBUG=1` on a local `next start` reachable over LAN, then read the raw payload from the server log. Change the shortcut only after seeing real data. Known codes: `1001` + `Unit 16` = last N days, `1002` = today.
