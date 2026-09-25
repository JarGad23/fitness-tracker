# Fitness Tracker - Instrukcje dla Claude

## Szybki Start

```bash
npm run dev    # Turbopack (dev)
npm run build  # webpack — celowo, Serwist wstrzykuje service worker pluginem webpacka
```

Otwórz: http://localhost:3000

## O Projekcie

Polska aplikacja fitness do śledzenia tygodniowych celów treningowych. Użytkownik loguje aktywności dowolnego dnia, cel to "wyczyścić" tygodniową pulę.

**Właściciel:** Jarek (jarek@biggerpicture.agency)

## Kluczowe Pliki

| Plik | Opis |
|------|------|
| `src/app/(app)/page.tsx` | Główny dashboard |
| `src/components/calendar-view.tsx` | Kalendarz (miesiąc/tydzień) |
| `src/components/weekly-progress.tsx` | Paski postępu |
| `src/lib/activity-colors.ts` | **WAŻNE:** Mapowanie kolorów |
| `src/lib/db/schema.ts` | Schema bazy danych |
| `src/actions/workouts.ts` | Server actions dla treningów |
| `src/app/api/watch-sync/route.ts` + `src/lib/health-sync.ts` | Dane z Apple Watch (skrót „Watch Sync v2”) |
| `HANDOFF.md` | Pełna dokumentacja projektu |

## Kolory Aktywności

Kolor i ikona są ustawiane per aktywność w Ustawieniach (kolumna `color`, hex). Domyślne:

```
Siłownia  → żółty    (yellow-500)
Bieganie  → pomarańczowy (orange-500)
Rower     → zielony  (green-500)
Basen     → niebieski (blue-500)
```

## Baza Danych

- **Turso** (SQLite edge) - credentials w `.env`
- Migracje: `npm run db:generate` + `npm run db:migrate` — **najpierw** przeczytaj HANDOFF.md §7 (baza nie ma jeszcze tabeli `__drizzle_migrations`)
- Schema: `src/lib/db/schema.ts`

## Stack

- Next.js 16 (Cache Components / PPR), React 19, Tailwind 4, Base UI (shadcn „base-nova”, nie Radix)
- Drizzle ORM + Turso
- NextAuth.js (30-dniowa sesja)
- Font: Plus Jakarta Sans

## Ważne

1. **Build zostaje na webpacku** (`next build --webpack`) — Turbopack pomija service worker Serwista. Dev na Turbopacku jest OK.
2. **Język UI: Polski** - wszystkie texty po polsku
3. **Tydzień: Pn-Nd** - `weekStartsOn: 1` w date-fns
4. **Figma design:** https://www.figma.com/design/LJ5jxjF0XwvRoB2sj7ZyAv

## Przeczytaj

Przed wprowadzaniem zmian przeczytaj `HANDOFF.md` - zawiera pełny kontekst projektu.
