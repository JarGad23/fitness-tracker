# MVP — dokończenie HANDOFF §8

## Confetti przy ukończeniu celu
- [x] Bezzależnościowy canvas confetti (`src/lib/confetti.ts`)
- [x] Trigger w `weekly-progress.tsx` (baseline per tydzień via `weekKey`, reset przy zmianie tygodnia)
- [ ] **[USER/Windows]** wizualna weryfikacja (dodaj trening domykający cel → confetti)

## PWA ikony PNG
- [x] Kanoniczny `public/icons/icon.svg`
- [x] Skrypt `scripts/generate-icons.mjs` (sharp) → 192/512/apple-touch
- [x] `layout.tsx`: icon svg + apple-touch-icon
- [ ] **[USER/Windows]** `node scripts/generate-icons.mjs`

## Service Worker (@serwist/next)
- [x] `src/app/sw.ts`
- [x] `withSerwist` w `next.config.ts` (disable w dev)
- [x] build → `next build --webpack` (serwist wymaga webpack); `.gitignore` na public/sw.js
- [ ] **[USER/Windows]** `npm run build` + sprawdź rejestrację SW (DevTools > Application)

## Deploy Vercel
- [ ] **[USER]** import repo, env, rotacja sekretów (checklist niżej)

## Higiena
- [x] `.claude/settings.local.json` JEST trackowany — rekomendacja: `git rm --cached` (nie wykonano, decyzja usera)
- [x] Migracje `0001`/`0002` mają duration/color — spójne ze schematem

## Review
- Confetti: czysty canvas, bez nowych zależności (ważne — `npm install` z WSL zakazany). Respektuje prefers-reduced-motion. Fire tylko na przejście incomplete→complete, reset per tydzień → brak false-positive na nawigacji.
- Ikony: sharp nie działa w WSL → skrypt do odpalenia na Windows. Manifest już wskazywał na (brakujące) PNG — skrypt je tworzy.
- SW: serwist wstrzykuje przez webpack-plugin → build prod MUSI być webpack. Dev (turbopack) nietknięty dzięki `disable`. RYZYKO: zgodność serwist 9.5 ↔ Next 16 do potwierdzenia buildem na Windows.
- tsc + eslint: czyste na wszystkich zmianach. Build/ikony/deploy: po stronie usera (Windows), bo WSL nie buduje i nie ma binarek natywnych.
- NIE commitowano — czeka na decyzję usera.
