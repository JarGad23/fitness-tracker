# Fitness Tracker - Dokumentacja Projektu (Handoff)

## 📋 Przegląd Projektu

**Cel:** Osobista aplikacja do śledzenia celów fitness w systemie "Weekly Pool" (pula tygodniowa).

**Język:** Polski (cały UI)

**Użytkownik:** Jarek (jarek@biggerpicture.agency)

**Status:** MVP zaimplementowany, UI przeprojektowany na styl kalendarzowy

---

## 🛠 Stack Technologiczny

| Warstwa | Technologia | Wersja |
|---------|-------------|--------|
| Framework | Next.js | 16.2.6 |
| React | React | 19.2.4 |
| Styling | Tailwind CSS | 4.x |
| UI Components | shadcn/ui | latest |
| Database | Turso (SQLite edge) | - |
| ORM | Drizzle ORM | 0.45.2 |
| Auth | NextAuth.js | 5.0.0-beta.31 |
| Font | Plus Jakarta Sans | Google Fonts |

---

## 🗄 Baza Danych

### Połączenie Turso
```
DATABASE_URL=libsql://fitness-tracker-jarek.aws-eu-west-1.turso.io
DATABASE_AUTH_TOKEN=eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODAzMjM2OTMsImlkIjoiMDE5ZTgzN2ItYjUwMS03MTM3LTkzZDgtNjU1ZTNkZDgyOGIwIiwicmlkIjoiOTNkNjA3YzAtZTM3MS00ZGU2LWE5MGItMmE5MmQxMDUxNGNiIn0.AyTwSeaBim17S169lCaFs3Vas2PZZlWCpQKQEXWSFjsiA9aLoskz2EC_8KOxXk5uFYGYNtkSDmpyHd8VfwyJCQ
AUTH_SECRET=fitness-tracker-secret-key-change-in-production-2026
```

### Schema (3 tabele)
```
src/lib/db/schema.ts
```

**users:**
- id (text, PK)
- email (text, unique)
- password_hash (text)
- created_at (integer/timestamp)

**activity_types:**
- id (text, PK)
- user_id (FK -> users)
- name (text) - "Siłownia", "Bieganie", "Rower", "Basen"
- target_per_week (integer) - cel tygodniowy
- icon (text) - nazwa ikony Lucide
- sort_order (integer)
- created_at (integer/timestamp)

**workouts:**
- id (text, PK)
- user_id (FK -> users)
- activity_type_id (FK -> activity_types)
- date (text) - ISO date "2026-06-01"
- notes (text, nullable)
- created_at (integer/timestamp)

### Migracje
Migracja została wykonana: `drizzle/0000_goofy_golden_guardian.sql`
Uruchomiona przez: `npx tsx scripts/migrate.ts`

---

## 🎨 Kolorystyka Aktywności (WAŻNE!)

Użytkownik zmienił domyślne kolory:

| Aktywność | Kolor | Tailwind Classes |
|-----------|-------|------------------|
| Siłownia | Żółty | `bg-yellow-500`, `text-yellow-600`, `bg-yellow-100` |
| Bieganie | Pomarańczowy | `bg-orange-500`, `text-orange-600`, `bg-orange-100` |
| Rower | Zielony | `bg-green-500`, `text-green-600`, `bg-green-100` |
| Basen | Niebieski | `bg-blue-500`, `text-blue-600`, `bg-blue-100` |

Kolory zdefiniowane w: `src/lib/activity-colors.ts`

---

## 📁 Struktura Projektu

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx        # Strona logowania
│   │   └── register/page.tsx     # Strona rejestracji
│   ├── (app)/
│   │   ├── layout.tsx            # Layout z headerem i auth guard
│   │   ├── page.tsx              # Dashboard - kalendarz + postęp
│   │   ├── historia/page.tsx     # Historia tygodni
│   │   └── ustawienia/page.tsx   # Zarządzanie typami aktywności
│   ├── api/
│   │   └── auth/[...nextauth]/route.ts
│   ├── layout.tsx                # Root layout (Inter font, PWA meta)
│   └── globals.css               # Tailwind + shadcn + zielony theme
├── components/
│   ├── ui/                       # shadcn components (button, card, dialog, etc.)
│   ├── calendar-grid.tsx         # NOWY! Kalendarz tygodniowy (7 dni)
│   ├── weekly-progress.tsx       # Paski postępu z kolorami
│   ├── add-activity-modal.tsx    # Modal dodawania aktywności
│   ├── week-selector.tsx         # Nawigacja między tygodniami
│   └── day-log.tsx               # STARY - zastąpiony przez calendar-grid
├── actions/
│   ├── auth.ts                   # register, login, logout
│   ├── workouts.ts               # getWeekWorkouts, addWorkout, deleteWorkout
│   └── activity-types.ts         # CRUD dla typów aktywności
├── lib/
│   ├── db/
│   │   ├── index.ts              # Drizzle + Turso client
│   │   └── schema.ts             # Tabele + relacje
│   ├── auth.ts                   # NextAuth config (30-dniowa sesja)
│   ├── utils.ts                  # cn() + funkcje dat (pl locale)
│   └── activity-colors.ts        # NOWY! Mapowanie kolorów aktywności
├── middleware.ts                 # Auth middleware
└── types/
    └── next-auth.d.ts            # Rozszerzenie typów sesji
```

---

## 🔐 Autentykacja

- **Provider:** Credentials (email + hasło)
- **Sesja:** JWT, 30 dni ważności
- **Hasła:** bcryptjs (hash)
- **Middleware:** Chroni wszystkie routes oprócz /login, /register, /api, /_next, /icons

Przy rejestracji automatycznie tworzone są 4 domyślne typy aktywności:
- Siłownia (4x/tydzień, ikona: Dumbbell)
- Bieganie (3x/tydzień, ikona: PersonStanding)
- Rower (3x/tydzień, ikona: Bike)
- Basen (2x/tydzień, ikona: Waves)

---

## 📅 Logika Tygodnia

- Tydzień: **Poniedziałek - Niedziela**
- Funkcje w `src/lib/utils.ts`:
  - `getWeekRange(date)` - start/end tygodnia
  - `getWeekDays(date)` - tablica 7 dni
  - `getWeekLabel(date)` - "Tydzień 23 (1 cze - 7 cze)"
  - `toISODateString(date)` - format "2026-06-01"
  - `isToday(date)` - czy dzień jest dzisiaj
- Locale: **pl** (date-fns)

---

## 🎯 Funkcjonalności

### ✅ Zaimplementowane
1. **Rejestracja/Logowanie** - publiczna rejestracja
2. **Dashboard** - kalendarz tygodniowy + paski postępu
3. **Dodawanie aktywności** - modal z wyborem typu i notatką
4. **Usuwanie aktywności** - bezpośrednio z kalendarza
5. **Nawigacja tygodni** - poprzedni/następny tydzień
6. **Historia** - lista tygodni z % ukończenia
7. **Ustawienia** - CRUD typów aktywności
8. **PWA manifest** - /public/manifest.json

### ⏳ Do dokończenia
1. **PWA ikony** - potrzebne PNG 192x192 i 512x512 (jest SVG w /public/icons/)
2. **Service Worker** - @serwist/next zainstalowany, ale nie skonfigurowany
3. **Animacje** - confetti przy ukończeniu celu
4. **Toasty** - sonner zainstalowany, ale nie zintegrowany
5. **Deploy na Vercel**

---

## 🎨 Design (Figma)

**Plik Figma:** https://www.figma.com/design/LJ5jxjF0XwvRoB2sj7ZyAv

Zawiera:
- Dashboard z kalendarzem tygodniowym
- Modal dodawania aktywności
- Strona ustawień

**Styl:** Kolorowy/Żywy z gradientami i wyraźnymi kolorami per aktywność

---

## ⚠️ Znane Problemy

1. **Turbopack nie działa na WSL** - zmieniono na webpack (`next dev` bez --turbopack)
2. **Figma MCP rate limit** - starter plan ma limit wywołań

---

## 🚀 Komendy

```bash
# Development
npm run dev

# Build
npm run build

# Database
npm run db:generate   # Generuj migracje
npm run db:push       # Push do Turso (może nie działać - użyj migrate.ts)
npx tsx scripts/migrate.ts  # Ręczna migracja

# Linting
npm run lint
```

---

## 📝 Decyzje Projektowe

1. **Next.js 16 zamiast TanStack Start** - użytkownik zna Next.js, łatwiejsze do weryfikacji
2. **Turso zamiast lokalnego SQLite** - darmowy tier, edge database
3. **Publiczna rejestracja** - możliwość dodania innych użytkowników w przyszłości
4. **Tydzień pon-nd** - użytkownik preferuje ten układ
5. **Bez trackowania czasu** - tylko fakt wykonania treningu
6. **Notatki opcjonalne** - główny focus na done/not done
7. **Kalendarzowy layout** - zamiast listy dni, grid 7 kolumn

---

## 🔗 Linki

- **Turso Dashboard:** https://turso.tech/app
- **Figma Design:** https://www.figma.com/design/LJ5jxjF0XwvRoB2sj7ZyAv
- **Vercel:** (do deploymentu)

---

## 📄 Pliki Konfiguracyjne

- `drizzle.config.ts` - Drizzle + Turso config
- `next.config.ts` - Next.js config (domyślny)
- `tsconfig.json` - TypeScript config
- `postcss.config.mjs` - PostCSS + Tailwind
- `.env` - Zmienne środowiskowe (DATABASE_URL, DATABASE_AUTH_TOKEN, AUTH_SECRET)
- `.env.example` - Przykładowe zmienne

---

## 🧪 Testowanie

Aby przetestować aplikację:
1. `npm run dev`
2. Otwórz http://localhost:3000
3. Zarejestruj nowe konto
4. Automatycznie dostaniesz 4 typy aktywności
5. Kliknij na dzień w kalendarzu aby dodać aktywność
6. Sprawdź paski postępu poniżej

---

## 📌 Następne Kroki (dla AI agenta)

1. Uruchom `npm run dev` i przetestuj UI
2. Jeśli użytkownik chce zmiany - sprawdź odpowiedni plik w strukturze
3. Kolory aktywności są w `src/lib/activity-colors.ts`
4. Główny dashboard jest w `src/app/(app)/page.tsx`
5. Komponenty kalendarza: `src/components/calendar-grid.tsx`

---

*Ostatnia aktualizacja: 2026-06-01*
*Autor: Claude Opus 4.5*
