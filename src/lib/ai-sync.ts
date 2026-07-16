// Pure helpers for the "AI Coach Sync" feature: turn a week of activity into a
// Markdown brief to paste into an external AI coach (Gemini), and parse the JSON
// the coach returns back into target updates. No DB / server code here.

import type { ActivityType, Workout, HealthMetric } from "@/lib/db/schema";
import {
  getWeekRange,
  getWeekNumber,
  getPreviousWeek,
  formatDateDisplay,
  toISODateString,
} from "@/lib/utils";

export type WorkoutRow = Workout & { activityType: ActivityType };

export type ParsedTarget = { name: string; targetPerWeek: number };

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function buildWeekSection(
  label: string,
  activityTypes: ActivityType[],
  workouts: WorkoutRow[],
  healthMetrics: HealthMetric[],
  start: string,
  end: string
): string {
  const weekWorkouts = workouts.filter((w) => w.date >= start && w.date <= end);
  const weekHealth = healthMetrics.filter((h) => h.date >= start && h.date <= end);

  const lines: string[] = [`### ${label}`];

  for (const type of activityTypes) {
    const done = weekWorkouts.filter((w) => w.activityTypeId === type.id);
    const feelings = done
      .map((w) => w.feelingScore)
      .filter((s): s is number => s != null);
    const feelingAvg = avg(feelings);
    const feelingText =
      feelingAvg != null
        ? ` (śr. samopoczucie ${feelingAvg.toFixed(1)}/5)`
        : "";
    lines.push(
      `- **${type.name}**: ${done.length}/${type.targetPerWeek}${feelingText}`
    );
  }

  if (weekHealth.length > 0) {
    const calories = avg(
      weekHealth.map((h) => h.activeCalories).filter((v): v is number => v != null)
    );
    const hr = avg(
      weekHealth.map((h) => h.restingHr).filter((v): v is number => v != null)
    );
    const sleep = avg(
      weekHealth.map((h) => h.sleepHours).filter((v): v is number => v != null)
    );
    lines.push("", "**Zdrowie (Apple Watch, średnie dzienne):**");
    if (calories != null)
      lines.push(`- Kalorie aktywne: ${Math.round(calories)} kcal`);
    if (hr != null) lines.push(`- Tętno spoczynkowe: ${Math.round(hr)} bpm`);
    if (sleep != null) lines.push(`- Sen: ${sleep.toFixed(1)} h`);
  }

  return lines.join("\n");
}

/**
 * Build a Markdown brief for the current + previous week, ending with an
 * instruction block that tells the AI coach exactly what JSON to return.
 */
export function buildCoachMarkdown(
  activityTypes: ActivityType[],
  workouts: WorkoutRow[],
  healthMetrics: HealthMetric[],
  now: Date = new Date()
): string {
  const prev = getPreviousWeek(now);
  const curRange = getWeekRange(now);
  const prevRange = getWeekRange(prev);

  const curStart = toISODateString(curRange.start);
  const curEnd = toISODateString(curRange.end);
  const prevStart = toISODateString(prevRange.start);
  const prevEnd = toISODateString(prevRange.end);

  const curLabel = `Tydzień ${getWeekNumber(now)} — bieżący (${formatDateDisplay(
    curRange.start
  )} – ${formatDateDisplay(curRange.end)})`;
  const prevLabel = `Tydzień ${getWeekNumber(prev)} — poprzedni (${formatDateDisplay(
    prevRange.start
  )} – ${formatDateDisplay(prevRange.end)})`;

  const exampleTargets = activityTypes
    .map((t) => `    { "name": "${t.name}", "target_per_week": ${t.targetPerWeek} }`)
    .join(",\n");

  return [
    "# Raport treningowy dla trenera AI",
    "",
    buildWeekSection(
      prevLabel,
      activityTypes,
      workouts,
      healthMetrics,
      prevStart,
      prevEnd
    ),
    "",
    buildWeekSection(
      curLabel,
      activityTypes,
      workouts,
      healthMetrics,
      curStart,
      curEnd
    ),
    "",
    "---",
    "",
    "## Instrukcja dla AI",
    "Jesteś moim trenerem personalnym. Przeanalizuj powyższe dane i odpowiedz po polsku,",
    "w tej kolejności:",
    "",
    "1. **Ocena tygodnia** — co poszło dobrze, a co słabo (2–3 zdania).",
    "2. **Trend** — porównaj bieżący tydzień z poprzednim.",
    "3. **Samopoczucie i regeneracja** — wnioski z ocen samopoczucia (1–5), snu i tętna",
    "   spoczynkowego. Pomiń ten punkt, jeśli danych brak.",
    "4. **Rekomendacje** — 3 konkretne rady na nadchodzący tydzień.",
    "5. **Uzasadnienie celów** — dlaczego proponujesz właśnie takie liczby.",
    "",
    "Jeśli w danych są same zera lub jest ich za mało na sensowne wnioski — napisz to",
    "wprost, zamiast zgadywać.",
    "",
    "**Na samym końcu** odpowiedzi umieść blok JSON z celami na nadchodzący tydzień.",
    "Użyj dokładnie tych samych nazw aktywności co poniżej — aplikacja dopasowuje cele",
    "po nazwie, więc przetłumaczona lub zmieniona nazwa zostanie zignorowana.",
    "Nie umieszczaj w odpowiedzi żadnego innego bloku ```json```.",
    "",
    "```json",
    "{",
    '  "targets": [',
    exampleTargets,
    "  ]",
    "}",
    "```",
    "",
  ].join("\n");
}

/**
 * Parse the coach's reply into target updates. Accepts a raw JSON object or a
 * ```json ... ``` fenced block embedded in Markdown. Throws on invalid input.
 */
export function parseAITargets(text: string): ParsedTarget[] {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Pusta zawartość");

  // The coach replies with a written report *and* the JSON block, so pick the fence
  // deliberately rather than taking the first one: prefer ```json fences, and among
  // those take the last, since the prompt asks for it at the very end. Falls back to
  // any fence, then to the whole text (a raw JSON paste).
  let jsonText = trimmed;
  const jsonFences = [...trimmed.matchAll(/```json\s*([\s\S]*?)```/gi)];
  const fences =
    jsonFences.length > 0
      ? jsonFences
      : [...trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
  if (fences.length > 0) {
    jsonText = fences[fences.length - 1][1].trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("Nieprawidłowy JSON — wklej odpowiedź AI w formacie JSON");
  }

  const rawTargets =
    parsed && typeof parsed === "object" && "targets" in parsed
      ? (parsed as { targets: unknown }).targets
      : parsed;

  if (!Array.isArray(rawTargets)) {
    throw new Error('JSON musi zawierać tablicę "targets"');
  }

  const targets: ParsedTarget[] = [];
  for (const item of rawTargets) {
    if (!item || typeof item !== "object") continue;
    const name = (item as Record<string, unknown>).name;
    const target =
      (item as Record<string, unknown>).target_per_week ??
      (item as Record<string, unknown>).targetPerWeek;
    const targetNum =
      typeof target === "string" ? parseInt(target, 10) : target;
    if (
      typeof name === "string" &&
      name.trim() &&
      typeof targetNum === "number" &&
      Number.isFinite(targetNum) &&
      targetNum > 0
    ) {
      targets.push({ name: name.trim(), targetPerWeek: Math.round(targetNum) });
    }
  }

  if (targets.length === 0) {
    throw new Error("Brak poprawnych celów w JSON-ie");
  }

  return targets;
}
