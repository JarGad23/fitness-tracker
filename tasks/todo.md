# Watch-sync: fix updateTag + deduplikacja health_metrics

## Zrobione wcześniej (sesja poprzednia)
- [x] AI Coach Sync, feeling_score, webhook watch-sync, migracja 0003
- [x] Migracja 0003 ZAAPLIKOWANA do Turso (zweryfikowane zapytaniem do bazy)

## Sesja bieżąca
- [x] WATCH_SYNC_SECRET dopisany do .env (nie było go, wbrew SESSION-HANDOFF)
- [x] scripts/test-watch-sync.ps1 — powtarzalny test webhooka (omija problemy z PS 5.1)
- [x] BUG: updateTag() rzuca wyjątkiem w route handlerze → 500. Zamiana na revalidateTag(tag, "max")
- [x] Zweryfikowane realnym requestem: 401 dla złego tokenu, 200 + {"success":true} dla dobrego

## Deduplikacja health_metrics
- [x] Usunąć zduplikowane wiersze testowe (było 5, zostawiono 1)
- [x] schema.ts — uniqueIndex na (user_id, date)
- [x] drizzle/0004_health_metrics_unique.sql + snapshot + journal (ręcznie, drizzle-kit nie działa w WSL)
- [x] Zaaplikować 0004 do Turso (@libsql/client/web z WSL) — potwierdzone PRAGMA index_list
- [x] route.ts — onConflictDoUpdate zamiast czystego insert
- [x] Weryfikacja: tsc + eslint czyste; rebuild + 2x strzał skryptem → 1 wiersz, id/created_at z oryginału

## Prompt AI Coach — rozbudowa raportu
- [x] Instrukcja w buildCoachMarkdown: 5-punktowa analiza + blok JSON na końcu
- [x] parseAITargets: preferuje blok ```json (ostatni), fallback na dowolny fence, potem raw
- [x] Zweryfikowane na prawdziwej funkcji: 4 przypadki (raw JSON, raport+json, decoy fence, śmieci)

## Sprzątanie przed commitem
- [x] scripts/test-watch-sync.ps1 — usunięty hardkodowany email, -Email wymagany, dodany -Secret dla Vercela
- [x] Audyt: sekret tylko w .env (gitignored), watch-body.json skasowany, zero danych osobowych w commicie
- [x] SESSION-HANDOFF.md usunięty — treść przeniesiona do HANDOFF.md (odzysk: git show c7ca2cc:SESSION-HANDOFF.md)
- [x] HANDOFF.md zaktualizowany: sekcje 4/5/6/7/8 (health_metrics, webhook, ai-coach, WATCH_SYNC_SECRET, gotcha updateTag, ręczne migracje)

## Do zrobienia przez Jarka
- [ ] Deploy na Vercel + WATCH_SYNC_SECRET w env (inaczej webhook → 500)
- [ ] Test webhooka na produkcji: skrypt z -BaseUrl https://... -Secret "..."
- [ ] Apple Shortcuts na publiczny URL — prawdziwe dane z zegarka
- [ ] Gwiazdki samopoczucia — dodać trening, sprawdzić zapis i edycję, potem `(śr. samopoczucie X/5)` na /ai-coach
- [ ] Pełna pętla z Gemini na PRAWDZIWYCH danych (przy zerach raport będzie bezwartościowy)

## Review
- **BUG (znaleziony i naprawiony):** `updateTag()` w route handlerze zawsze rzuca wyjątkiem.
  Next.js 16 `revalidate.js:52`: `if (!workStore || workStore.page.endsWith('/route')) throw`.
  Nasz `/api/watch-sync/route` kończy się na `/route`, więc każdy strzał = gołe 500.
  Insert do bazy przechodził, wyjątek leciał linijkę później — stąd 4 śmieciowe wiersze
  z nieudanych prób. Fix: `revalidateTag("health-metrics", "max")`. W server actions
  `updateTag` zostaje — tam jest poprawny.
  **Lekcja:** tsc tego nie łapie (sygnatura poprawna, kontrakt sprawdzany w runtime).
  Poprzednia sesja weryfikowała tylko typami i uznała feature za gotowy.
- **Dedup:** unikalny indeks `health_metrics_user_date_unique` na (user_id, date) + upsert
  `onConflictDoUpdate` w route. Ten sam dzień nadpisuje się zamiast mnożyć wiersze;
  id/created_at zostają z pierwszego zapisu. Dowód: po 2 strzałach 1 wiersz, id niezmienione.
- **WATCH_SYNC_SECRET** nie był w .env, wbrew SESSION-HANDOFF. Dopisany (64 hex).
- **scripts/test-watch-sync.ps1** — czyta sekret z .env, sam buduje JSON, testuje 401 i 200.
  Powstał, bo Windows PowerShell 5.1 rozjeżdża wklejane wieloliniowe komendy: łamał string
  w środku nagłówka Authorization, przez co Node odrzucał request gołym 400 (bez ciała) —
  fałszywy trop, który wyglądał jak błąd aplikacji.
- **Baza zweryfikowana bezpośrednio:** migracja 0003 BYŁA zaaplikowana (health_metrics +
  feeling_score istnieją), wbrew niezaznaczonemu checkboxowi w starym todo.
- Nie zmieniono: żadnych server actions, żadnej logiki AI Coach.
