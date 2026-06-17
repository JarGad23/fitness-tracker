# Fitness Tracker - Instrukcje dla Claude

## Szybki Start

```bash
npm run dev  # Uruchom serwer (webpack, nie turbopack - WSL!)
```

Otwórz: http://localhost:3000

## O Projekcie

Polska aplikacja fitness do śledzenia tygodniowych celów treningowych. Użytkownik loguje aktywności dowolnego dnia, cel to "wyczyścić" tygodniową pulę.

**Właściciel:** Jarek (jarek@biggerpicture.agency)

## Kluczowe Pliki

| Plik | Opis |
|------|------|
| `src/app/(app)/page.tsx` | Główny dashboard |
| `src/components/calendar-grid.tsx` | Kalendarz tygodniowy |
| `src/components/weekly-progress.tsx` | Paski postępu |
| `src/lib/activity-colors.ts` | **WAŻNE:** Mapowanie kolorów |
| `src/lib/db/schema.ts` | Schema bazy danych |
| `src/actions/workouts.ts` | Server actions dla treningów |
| `HANDOFF.md` | Pełna dokumentacja projektu |

## Kolory Aktywności

```
Siłownia  → żółty    (yellow-500)
Bieganie  → pomarańczowy (orange-500)
Rower     → zielony  (green-500)
Basen     → niebieski (blue-500)
```

## Baza Danych

- **Turso** (SQLite edge) - credentials w `.env`
- Migracje: `npx tsx scripts/migrate.ts`
- Schema: `src/lib/db/schema.ts`

## Stack

- Next.js 16, React 19, Tailwind 4, shadcn/ui
- Drizzle ORM + Turso
- NextAuth.js (30-dniowa sesja)
- Font: Plus Jakarta Sans

## Ważne

1. **NIE używaj Turbopack** - nie działa na WSL, użyj `next dev` bez flagi
2. **Język UI: Polski** - wszystkie texty po polsku
3. **Tydzień: Pn-Nd** - `weekStartsOn: 1` w date-fns
4. **Figma design:** https://www.figma.com/design/LJ5jxjF0XwvRoB2sj7ZyAv

## Przeczytaj

Przed wprowadzaniem zmian przeczytaj `HANDOFF.md` - zawiera pełny kontekst projektu.
