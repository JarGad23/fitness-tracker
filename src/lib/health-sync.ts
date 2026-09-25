// Pure parsers for the Apple Health payload sent by the "Watch Sync v2" shortcut.
// The shortcut does no math: it sends the last week of samples as plain text lines
// and all aggregation happens here, where it can be tested. No DB / server code.
//
// Payload fields (all optional, each one line per item):
//   active_calories  "2026-09-24;512.3"                              (grouped by day)
//   resting_hr       "2026-09-24;54"                                 (raw samples)
//   sleep            "2026-09-23T23:10:00;2026-09-24T06:40:00;Core"  (raw samples)
// Shortcuts formats numbers with the phone's locale, so values may use a decimal
// comma and space/nbsp thousand separators ("1 234,5").

export type DayMetrics = {
  date: string;
  activeCalories: number | null;
  restingHr: number | null;
  sleepHours: number | null;
};

export type SleepLabelStat = { label: string; samples: number; counted: boolean };

export type ParsedHealthPayload = {
  days: DayMetrics[];
  sleepLabels: SleepLabelStat[];
  ignoredLines: string[];
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;

// Sleep stages that are not sleep. Health reports labels in the phone's language.
const NOT_ASLEEP = ["awake", "czuwanie", "in bed", "inbed", "w łóżku"];

// A sleep block belongs to the day you wake up on. Blocks ending in the evening
// (from 18:00) are the start of the next night, so shift by 6h before taking the date.
const SLEEP_DAY_SHIFT_MS = 6 * 60 * 60 * 1000;

// The daily shortcut sends 7 days; a one-off backfill shortcut can send months of
// history. Anything older than a year is treated as junk.
const MAX_AGE_DAYS = 366;

export function parseLocaleNumber(raw: string): number | null {
  const cleaned = raw.replace(/[\s  ]/g, "").replace(",", ".");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function lines(text: unknown): string[] {
  if (typeof text !== "string") return [];
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

// Local wall-clock time as a sortable number. Both ends of a sample are in the same
// time zone, so treating them as UTC keeps durations right without knowing the zone.
function parseWallClock(raw: string): number | null {
  const m = DATETIME_RE.exec(raw.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  return Date.UTC(+y, +mo - 1, +d, +h, +mi, s ? +s : 0);
}

function wallClockDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

// One value per day. Several lines for the same day (raw samples rather than a
// grouped total) are averaged.
function parseDaily(
  text: unknown,
  ignored: string[]
): Map<string, number> {
  const acc = new Map<string, { sum: number; count: number }>();
  for (const line of lines(text)) {
    const [date, value] = line.split(";");
    const n = value != null ? parseLocaleNumber(value) : null;
    if (!DATE_RE.test(date ?? "") || n == null) {
      ignored.push(line);
      continue;
    }
    const a = acc.get(date) ?? { sum: 0, count: 0 };
    a.sum += n;
    a.count += 1;
    acc.set(date, a);
  }
  return new Map([...acc].map(([date, a]) => [date, a.sum / a.count]));
}

function parseSleep(
  text: unknown,
  ignored: string[]
): { hoursByDay: Map<string, number>; labels: SleepLabelStat[] } {
  const labels = new Map<string, SleepLabelStat>();
  const intervals: [number, number][] = [];

  for (const line of lines(text)) {
    const [startRaw, endRaw, labelRaw = ""] = line.split(";");
    const start = startRaw ? parseWallClock(startRaw) : null;
    const end = endRaw ? parseWallClock(endRaw) : null;
    if (start == null || end == null || end <= start) {
      ignored.push(line);
      continue;
    }

    const label = labelRaw.trim();
    const counted = !NOT_ASLEEP.includes(label.toLowerCase());
    const stat = labels.get(label) ?? { label, samples: 0, counted };
    stat.samples += 1;
    labels.set(label, stat);

    if (counted) intervals.push([start, end]);
  }

  // Watch and iPhone can both write the same night, and stages may overlap, so
  // merge intervals before summing instead of adding sample durations.
  intervals.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [s, e] of intervals) {
    const last = merged[merged.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }

  const hoursByDay = new Map<string, number>();
  for (const [s, e] of merged) {
    const day = wallClockDate(e + SLEEP_DAY_SHIFT_MS);
    hoursByDay.set(day, (hoursByDay.get(day) ?? 0) + (e - s) / 3_600_000);
  }

  return { hoursByDay, labels: [...labels.values()] };
}

/**
 * Turn the v2 payload into one row per day. `today` (local "YYYY-MM-DD") bounds
 * the accepted range: no future days, nothing older than MAX_AGE_DAYS.
 */
export function parseHealthPayload(
  body: Record<string, unknown>,
  today: string
): ParsedHealthPayload {
  const ignoredLines: string[] = [];
  const calories = parseDaily(body.active_calories, ignoredLines);
  const restingHr = parseDaily(body.resting_hr, ignoredLines);
  const sleep = parseSleep(body.sleep, ignoredLines);

  const todayMs = Date.parse(`${today}T00:00:00Z`);
  const oldest = wallClockDate(todayMs - MAX_AGE_DAYS * 86_400_000);

  const dates = new Set([
    ...calories.keys(),
    ...restingHr.keys(),
    ...sleep.hoursByDay.keys(),
  ]);

  // Non-positive values mean "no data" (e.g. a night without the watch), not zero.
  const positive = (n: number | undefined) => (n != null && n > 0 ? n : null);

  const days = [...dates]
    .filter((d) => d <= today && d >= oldest)
    .sort()
    .map((date) => {
      const kcal = positive(calories.get(date));
      const hr = positive(restingHr.get(date));
      const sleepH = positive(sleep.hoursByDay.get(date));
      return {
        date,
        activeCalories: kcal != null ? Math.round(kcal) : null,
        restingHr: hr != null ? Math.round(hr) : null,
        sleepHours: sleepH != null ? Math.round(sleepH * 100) / 100 : null,
      };
    });

  return { days, sleepLabels: sleep.labels, ignoredLines };
}
