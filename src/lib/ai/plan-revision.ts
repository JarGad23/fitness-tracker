import { z } from "zod";
import { v4 as uuid } from "uuid";
import { and, desc, eq, gte } from "drizzle-orm";
import { parseISO, subWeeks } from "date-fns";
import { db } from "@/lib/db";
import { dayNotes, planRevisions, users, workoutSets, workouts, exercises } from "@/lib/db/schema";
import type { PlanChange } from "@/lib/db/schema";
import { getAI } from "@/lib/ai";
import { formatPlan, loadTrainingPlan, type LoadedPlan } from "@/lib/ai/context";
import { briefSection, RULES } from "@/lib/ai/prompts";
import { withAICall } from "@/lib/ai/guard";
import { AI_MODELS } from "@/lib/ai/models";
import { DAY_TAGS } from "@/lib/day-notes";
import { exerciseKey, formatReps } from "@/lib/gym";
import { suggestSets } from "@/lib/plan";
import { toISODateString } from "@/lib/utils";

// AI review of the training plan. The model proposes changes; they are validated here
// against the real plan and stored as a revision. Nothing in the plan changes until
// the user applies a change (src/actions/plan-revisions.ts).

export const REVISION_HISTORY_WEEKS = 8;
export const MAX_CHANGES = 8;
export const SETS_RANGE = { min: 1, max: 6 };
export const REPS_RANGE = { min: 1, max: 120 }; // seconds for timed exercises

const TASK = `Przejrzyj plan treningowy na tle zapisanych serii (historia ćwiczeń w wiadomości) i zaproponuj zmiany — tylko takie, które dane naprawdę uzasadniają:
- stagnacja: ten sam ciężar i powtórzenia przez 3+ sesje mimo pełnych serii,
- ćwiczenie stale pomijane albo wykonywane zamiennikiem,
- ból lub problem w notatkach dni (zwłaszcza ograniczenia z briefu, np. bark),
- zakres powtórzeń wyraźnie za łatwy lub za trudny,
- rozjazd z celami z briefu.
Ćwiczenia z mniej niż 3 sesjami zostaw w spokoju — za mało danych. Jeśli nic nie wymaga zmiany, zwróć pustą listę i napisz to w podsumowaniu. Najwyżej 5 zmian.

Nie zmieniasz ciężarów — progresję liczy aplikacja (podwójna progresja). Zmieniasz strukturę planu:
- "update": plan_exercise_id + nowe wartości tylko tych pól, które się zmieniają (sets, rep_min, rep_max, tips, alternative); pozostałe null.
- "replace": plan_exercise_id + exercise_name (nowe ćwiczenie, unit "sec" dla ćwiczeń na czas); sets/rep_min/rep_max tylko jeśli mają się zmienić.
- "add": day_label + exercise_name + sets + rep_min + rep_max (+ tips); dodaje ćwiczenie na koniec dnia.
- "remove": plan_exercise_id.
Id bierz z planu ([id: …]). Pole "reason": 1–2 zdania, konkretnie, z odwołaniem do liczb z historii.
Pole "summary": 2–4 zdania o tym, jak plan działa i co zmieniasz (Markdown, bez nagłówków).`;

// The user's own wish goes first: it doesn't need backing from the history, but the
// brief's limits (shoulder) still hold, and the model says so instead of complying blindly.
const requestSection = (request: string) => `## Prośba użytkownika
Użytkownik sam prosi o zmiany w planie:
"""
${request}
"""
Zrealizuj tę prośbę zmianami z listy — to jego decyzja, nie potrzebuje uzasadnienia w historii, a limit 5 zmian jej nie dotyczy (łącznie najwyżej ${MAX_CHANGES}). W "reason" napisz, której części prośby dotyczy zmiana. Jeśli coś z prośby kłóci się z ograniczeniami z briefu (np. bark), nie wykonuj tego wprost: zaproponuj bezpieczniejszy wariant i wyjaśnij to w "summary". Jeśli czegoś nie da się zapisać tymi typami zmian (np. kolejność ćwiczeń, rozgrzewka), napisz to w "summary". Inne zmiany wynikające z danych proponuj tylko, jeśli są naprawdę ważne.`;

function revisionSchema(plan: LoadedPlan) {
  const ids = plan.days.flatMap((d) => d.exercises.map((e) => e.id)) as [string, ...string[]];
  const labels = plan.days.map((d) => d.label) as [string, ...string[]];
  const count = (range: { min: number; max: number }) =>
    z.number().int().min(range.min).max(range.max).nullable();
  return z.object({
    summary: z.string().min(1),
    changes: z
      .array(
        z.object({
          type: z.enum(["update", "replace", "add", "remove"]),
          plan_exercise_id: z.enum(ids).nullable(),
          day_label: z.enum(labels).nullable(),
          exercise_name: z.string().max(80).nullable(),
          unit: z.enum(["reps", "sec"]).nullable(),
          sets: count(SETS_RANGE),
          rep_min: count(REPS_RANGE),
          rep_max: count(REPS_RANGE),
          tips: z.string().max(300).nullable(),
          alternative: z.string().max(200).nullable(),
          reason: z.string().min(1),
        })
      ),
    // No .max() here: Gemini rejects maxItems on an array of objects this size with a
    // bare 400 "invalid argument" (bisected 2026-10-15). MAX_CHANGES is applied in code.
  });
}

type RawChange = z.infer<ReturnType<typeof revisionSchema>>["changes"][number];

const dayHasExercise = (plan: LoadedPlan, dayLabel: string, name: string) =>
  plan.days
    .find((d) => d.label === dayLabel)
    ?.exercises.some((e) => exerciseKey(e.exercise.name) === exerciseKey(name)) ?? false;

/** Keeps only changes that make sense for this plan; one change per plan exercise. */
export function validateChanges(raw: RawChange[], plan: LoadedPlan): PlanChange[] {
  const byId = new Map(plan.days.flatMap((d) => d.exercises.map((e) => [e.id, e] as const)));
  const dayOf = new Map(plan.days.flatMap((d) => d.exercises.map((e) => [e.id, d.label] as const)));
  const touched = new Set<string>();
  const valid: PlanChange[] = [];
  for (const c of raw) {
    const change: PlanChange = {
      type: c.type,
      planExerciseId: c.plan_exercise_id,
      dayLabel: c.day_label,
      exerciseName: c.exercise_name?.trim().replace(/\s+/g, " ") || null,
      unit: c.unit,
      sets: c.sets,
      repMin: c.rep_min,
      repMax: c.rep_max,
      tips: c.tips?.trim() || null,
      alternative: c.alternative?.trim() || null,
      reason: c.reason.trim(),
      status: "pending",
      before: null,
    };
    const current = change.planExerciseId ? byId.get(change.planExerciseId) : undefined;
    if (current) {
      change.before = {
        exerciseName: current.exercise.name,
        dayLabel: dayOf.get(current.id)!,
        unit: current.exercise.unit,
        sets: current.sets,
        repMin: current.repMin,
        repMax: current.repMax,
      };
    }
    if (change.type !== "add") {
      if (!current || touched.has(current.id)) continue;
    }
    const repMin = change.repMin ?? current?.repMin;
    const repMax = change.repMax ?? current?.repMax;
    if (repMin != null && repMax != null && repMin > repMax) continue;

    if (change.type === "update") {
      const same =
        (change.sets == null || change.sets === current!.sets) &&
        (change.repMin == null || change.repMin === current!.repMin) &&
        (change.repMax == null || change.repMax === current!.repMax) &&
        (change.tips == null || change.tips === current!.tips) &&
        (change.alternative == null || change.alternative === current!.alternative);
      if (same) continue;
    } else if (change.type === "replace") {
      if (!change.exerciseName) continue;
      if (exerciseKey(change.exerciseName) === exerciseKey(current!.exercise.name)) continue;
      // Seconds ↔ reps without a new range would leave e.g. a plank's 45–60 s as 45–60 reps.
      const unit = change.unit ?? current!.exercise.unit;
      if (unit !== current!.exercise.unit && (change.repMin == null || change.repMax == null)) continue;
      if (dayHasExercise(plan, dayOf.get(current!.id)!, change.exerciseName)) continue;
    } else if (change.type === "add") {
      if (!change.dayLabel || !change.exerciseName || change.sets == null) continue;
      if (change.repMin == null || change.repMax == null) continue;
      if (dayHasExercise(plan, change.dayLabel, change.exerciseName)) continue;
      change.planExerciseId = null;
    }
    if (current) touched.add(current.id);
    valid.push(change);
  }
  return valid.slice(0, MAX_CHANGES);
}

const fmtSet = (reps: number, weightKg: number | null, unit: "reps" | "sec") =>
  weightKg != null ? `${weightKg}×${formatReps(reps, unit)}` : `${formatReps(reps, unit)} bw`;

/** Per-exercise history for the last weeks, plus day notes, as text. */
async function describeHistory(userId: string, today: string, plan: LoadedPlan) {
  const since = toISODateString(subWeeks(parseISO(today), REVISION_HISTORY_WEEKS));
  const [rows, notes] = await Promise.all([
    db
      .select({
        exerciseId: workoutSets.exerciseId,
        name: exercises.name,
        unit: exercises.unit,
        workoutId: workouts.id,
        date: workouts.date,
        reps: workoutSets.reps,
        weightKg: workoutSets.weightKg,
      })
      .from(workoutSets)
      .innerJoin(workouts, eq(workouts.id, workoutSets.workoutId))
      .innerJoin(exercises, eq(exercises.id, workoutSets.exerciseId))
      .where(and(eq(workouts.userId, userId), gte(workouts.date, since)))
      .orderBy(workouts.date, workouts.createdAt, workoutSets.position),
    db.query.dayNotes.findMany({
      where: and(eq(dayNotes.userId, userId), gte(dayNotes.date, since)),
      orderBy: [desc(dayNotes.date)],
    }),
  ]);

  type Session = { workoutId: string; date: string; sets: { reps: number; weightKg: number | null }[] };
  const history = new Map<string, { name: string; unit: "reps" | "sec"; sessions: Session[] }>();
  for (const row of rows) {
    const entry = history.get(row.exerciseId) ?? { name: row.name, unit: row.unit, sessions: [] };
    const last = entry.sessions.at(-1);
    const set = { reps: row.reps, weightKg: row.weightKg };
    if (last?.workoutId === row.workoutId) last.sets.push(set);
    else entry.sessions.push({ workoutId: row.workoutId, date: row.date, sets: [set] });
    history.set(row.exerciseId, entry);
  }

  const lines = [`Historia od ${since} do ${today} (ciężar×powtórzenia, bw = masa ciała):`];
  const inPlan = new Set<string>();
  for (const day of plan.days) {
    lines.push("", `Dzień ${day.label}:`);
    for (const e of day.exercises) {
      inPlan.add(e.exerciseId);
      const entry = history.get(e.exerciseId);
      lines.push(`- ${e.exercise.name} [id: ${e.id}] — sesji: ${entry?.sessions.length ?? 0}`);
      for (const s of entry?.sessions ?? []) {
        lines.push(`  ${s.date}: ${s.sets.map((x) => fmtSet(x.reps, x.weightKg, e.exercise.unit)).join(", ")}`);
      }
      const last = entry?.sessions.at(-1)?.sets ?? null;
      const next = suggestSets(e, last, e.exercise.unit);
      if (next.hint) lines.push(`  aplikacja na następny raz: ${next.hint}`);
    }
  }
  const outside = [...history.entries()].filter(([id]) => !inPlan.has(id));
  if (outside.length > 0) {
    lines.push("", "Ćwiczenia spoza planu:");
    for (const [, entry] of outside) {
      lines.push(`- ${entry.name}: ${entry.sessions.length} sesji, ostatnio ${entry.sessions.at(-1)!.date}`);
    }
  }
  const tagLabel = new Map<string, string>(DAY_TAGS.map((t) => [t.key, t.label]));
  if (notes.length > 0) {
    lines.push("", "Notatki dni:");
    for (const n of notes) {
      const tags = n.tags.map((t) => tagLabel.get(t) ?? t).join(", ");
      lines.push(`- ${n.date}: ${[tags, n.text].filter(Boolean).join(" — ")}`);
    }
  }
  return lines.join("\n");
}

/** Builds the revision without saving it (`dryRun` also skips the limit and the log). */
export async function draftPlanRevision(
  userId: string,
  today: string,
  { dryRun = false, request }: { dryRun?: boolean; request?: string } = {}
) {
  const plan = await loadTrainingPlan(userId);
  if (!plan) return null;
  const [user, history] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, userId), columns: { coachBrief: true } }),
    describeHistory(userId, today, plan),
  ]);
  const system = [
    RULES,
    briefSection(user?.coachBrief?.trim() || null),
    `## Aktualny plan treningowy\n${formatPlan(plan, { withIds: true })}`,
    `## Zadanie\n${TASK}`,
    request && requestSection(request),
  ]
    .filter(Boolean)
    .join("\n\n");

  const model = AI_MODELS.plan;
  const call = (m: string) =>
    getAI().generateJson({ model: m, system, input: history, schema: revisionSchema(plan) });
  const { data, usage } = dryRun ? await call(model) : await withAICall(userId, "plan", call);

  return {
    plan,
    usage,
    rawCount: data.changes.length,
    revision: {
      userId,
      planId: plan.id,
      model,
      summary: data.summary.trim(),
      changes: validateChanges(data.changes, plan),
    },
  };
}

export async function generatePlanRevision(userId: string, today: string, request?: string) {
  const draft = await draftPlanRevision(userId, today, { request });
  if (!draft) return null;
  const id = uuid();
  await db.insert(planRevisions).values({ id, ...draft.revision });
  return id;
}
