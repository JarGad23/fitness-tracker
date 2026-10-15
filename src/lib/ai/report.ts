import { z } from "zod";
import { v4 as uuid } from "uuid";
import { parseISO, subWeeks } from "date-fns";
import { db } from "@/lib/db";
import { coachReports } from "@/lib/db/schema";
import { getAI } from "@/lib/ai";
import { loadCoachContext } from "@/lib/ai/context";
import { coachSystemPrompt } from "@/lib/ai/prompts";
import { withAICall } from "@/lib/ai/guard";
import { AI_MODELS } from "@/lib/ai/models";
import { getWeekRange, toISODateString } from "@/lib/utils";

// Weekly coach report: reviews the last closed Monday–Sunday week against the plan and
// the brief, and may propose new weekly targets. Targets are only stored — the user
// applies them on /ai-coach ("Zastosuj cele").

export const REPORT_CONTEXT_WEEKS = 8;

const TASK = `Napisz tygodniowy raport trenera za ostatni zamknięty tydzień (okres podany w wiadomości), na tle poprzednich tygodni.

Pole "body" (Markdown, bez nagłówka pierwszego poziomu), sekcje "## …":
- Ocena tygodnia — 2–4 zdania: realizacja celów, co poszło dobrze, co nie.
- Siłownia — postęp w kluczowych ćwiczeniach na podstawie zapisanych serii (ciężar × powtórzenia), regularność rotacji A/B/C. Pomiń sekcję, jeśli w tygodniu nie było siłowni.
- Regeneracja — sen, tętno spoczynkowe, notatki dni (choroba, wyjazd, góry) i jak wpłynęły na tydzień.
- Uwagi — tylko jeśli dane pokazują coś niepokojącego (np. powtarzający się ból, spadek siły, zbyt mało snu).
Krótko: cały raport do ok. 250 słów.

Pole "focus": 1–3 konkretne punkty na bieżący tydzień (czasownik na początku, np. „Zrób dzień B i C przed kolejnym A”). Uwzględnij to, co w bieżącym tygodniu już zostało zrobione — nie każ zaczynać czegoś, co już się odbyło.

Pole "targets": proponuj zmianę celów tygodniowych tylko wtedy, gdy obecne wyraźnie nie pasują do tego, co realnie robi użytkownik przez kilka tygodni (nie jeden słabszy tydzień). Podaj tylko aktywności, których cel ma się zmienić. Brak zmian = null.`;

export function lastClosedWeek(today: string) {
  const { start, end } = getWeekRange(subWeeks(parseISO(today), 1));
  return { start: toISODateString(start), end: toISODateString(end) };
}

function reportSchema(activityNames: [string, ...string[]]) {
  return z.object({
    body: z.string().min(1),
    focus: z.array(z.string()).min(1).max(3),
    targets: z
      .array(
        z.object({
          name: z.enum(activityNames),
          target_per_week: z.number().int().min(0).max(14),
        })
      )
      .nullable(),
  });
}

/**
 * Builds the report row without saving it. `dryRun` skips the limit and the ai_calls
 * log too (scripts/ai-dry-run.ts).
 */
export async function draftWeeklyReport(userId: string, today: string, { dryRun = false } = {}) {
  const period = lastClosedWeek(today);
  const context = await loadCoachContext(userId, today, REPORT_CONTEXT_WEEKS);
  const names = context.activityTypes.map((t) => t.name);
  if (names.length === 0) throw new Error("No activity types");

  const call = (model: string) =>
    getAI().generateJson({
      model,
      system: coachSystemPrompt(context, TASK),
      input: `Raport za tydzień ${period.start} – ${period.end}. Dziś jest ${today}.`,
      schema: reportSchema(names as [string, ...string[]]),
    });
  const model = AI_MODELS.report;
  const { data, usage } = dryRun ? await call(model) : await withAICall(userId, "report", call);

  // Only real changes, one entry per activity.
  const current = new Map(context.activityTypes.map((t) => [t.name, t.targetPerWeek]));
  const targets = [
    ...new Map((data.targets ?? []).map((t) => [t.name, t.target_per_week])).entries(),
  ]
    .filter(([name, target]) => current.get(name) !== target)
    .map(([name, targetPerWeek]) => ({ name, targetPerWeek }));

  const focus = data.focus.map((f) => `- ${f}`).join("\n");
  return {
    usage,
    report: {
      userId,
      body: `${data.body.trim()}\n\n## Fokus na ten tydzień\n${focus}`,
      model,
      periodStart: period.start,
      periodEnd: period.end,
      targets: targets.length > 0 ? targets : null,
    },
  };
}

/** Generates the report and stores it; returns the new coach_reports id. */
export async function generateWeeklyReport(userId: string, today: string) {
  const { report } = await draftWeeklyReport(userId, today);
  const id = uuid();
  await db.insert(coachReports).values({ id, ...report });
  return id;
}
