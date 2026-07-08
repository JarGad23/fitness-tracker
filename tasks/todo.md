# AI Markdown Sync + Apple Watch integration

## Zadania
- [x] Krok 1: schema — feeling_score + health_metrics + relacje/typy
- [x] Krok 1: migracja drizzle/0003_watch_and_feeling.sql (+ snapshot + journal, ręcznie — esbuild win nie działa w WSL)
- [x] Krok 2: workouts actions — feelingScore param
- [x] Krok 2: add-activity-modal — selektor samopoczucia (Star 1-5)
- [x] Krok 3: queries — getCachedHealthMetricsInRange
- [x] Krok 3: lib/ai-sync.ts — buildCoachMarkdown + parseAITargets
- [x] Krok 3: actions/ai-sync.ts — syncAITargets
- [x] Krok 3: ai-coach page + ai-coach-content component
- [x] Krok 3: nav links w layout (Sparkles)
- [x] Krok 4: watch-sync route handler (bearer token, timingSafeEqual)
- [x] Weryfikacja: tsc czysty, eslint czysty na wszystkich nowych/zmienionych plikach

## Do zrobienia przez Jarka (Windows / poza WSL)
- [ ] Zaaplikować migrację 0003 do Turso przez web client (patrz Review)
- [ ] Dodać WATCH_SYNC_SECRET do .env (i do env na Vercel)
- [ ] npm run build && npm start — wizualny sprawdzian /ai-coach, gwiazdek samopoczucia
- [ ] Test webhooka curl-em (patrz plan)

## Review
- Schema: `workouts.feeling_score` (int, nullable), nowa tabela `health_metrics`. Migrację 0003 napisałem ręcznie (SQL + meta/0003_snapshot.json + _journal), bo `drizzle-kit generate` w WSL pada na `@esbuild/win32-x64` (natywna binarka Windows). Format 1:1 jak 0002. NIE aplikowałem do bazy.
- feeling_score: dodane jako 5. param pozycyjny w add/updateWorkout (spójne ze stylem duration). Selektor gwiazdek w modalu, ponowny klik = reset.
- AI Coach Sync: eksport buduje markdown dla poprzedniego + bieżącego tygodnia (per aktywność X/target + śr. samopoczucie + blok Apple Watch), z instrukcją formatu JSON dla Gemini. Import: parseAITargets przyjmuje surowy JSON albo blok ```json``` w markdownie; syncAITargets dopasowuje po nazwie (case-insensitive), aktualizuje target_per_week, woła updateTag("activity-types").
- Cache/PPR: getCachedHealthMetricsInRange z cacheTag("health-metrics"); webhook woła updateTag("health-metrics"). Zgodne z arch. z HANDOFF.
- Webhook: bearer token porównany timingSafeEqual, 401/400/404/500, runtime nodejs (libSQL). Insert do health_metrics + updateTag.
- Pozostały error w lint dotyczy public/sw.js (wygenerowany, nietrackowany artefakt serwista) — nie moje zmiany.
- NIE commitowano — czeka na decyzję.
