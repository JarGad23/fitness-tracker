# Lessons

### Never build/install from WSL on this repo
**Avoid:** Running `npm run build`, `next build`, `next dev`, or `npm install` from WSL. The repo lives on `/mnt/c` (Windows) with shared `node_modules`. Builds create a Linux-owned `.next/` that breaks the user's Windows build with `EPERM: unlink`. Installs prune Windows native binaries (`@next/swc-win32`, `lightningcss-win32`, `@tailwindcss/oxide-win32`).
**Better:** From WSL verify with pure-JS tools only — `npm run lint` and `npx tsc --noEmit`. Both catch type/lint errors without native bindings. The user builds & runs on Windows. (Documented in HANDOFF.md §3.)

### Read HANDOFF.md §3 BEFORE touching build/deps
**Avoid:** Assuming a standard build verification flow.
**Better:** This project's HANDOFF.md is the source of truth and has hard environment constraints. Re-read it after any git pull/merge — it may have been updated.
