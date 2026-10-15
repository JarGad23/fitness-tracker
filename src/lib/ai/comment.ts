import { and, desc, eq, gte, inArray, lte, ne } from "drizzle-orm";
import { parseISO, subDays } from "date-fns";
import { db } from "@/lib/db";
import { dayNotes, healthMetrics, users, workoutSets, workouts } from "@/lib/db/schema";
import { getAI } from "@/lib/ai";
import { formatPlan, loadTrainingPlan } from "@/lib/ai/context";
import { briefSection, RULES } from "@/lib/ai/prompts";
import { withAICall } from "@/lib/ai/guard";
import { AI_MODELS, AI_THINKING } from "@/lib/ai/models";
import { DAY_TAGS } from "@/lib/day-notes";
import { formatReps, groupSetsByExercise } from "@/lib/gym";
import { formatRepRange, suggestSets, type PlannedSet } from "@/lib/plan";
import { toISODateString } from "@/lib/utils";

// Short coach comment on one gym session. The numbers (next-session suggestion,
// previous sessions) come from the app; the model only reads and explains them.

const PREVIOUS_SESSIONS = 3;
const NOTE_DAYS_BEFORE = 3;

const TASK = `Skomentuj trening siłowy opisany w wiadomości, jak trener po sesji: 2–4 zdania, po polsku, bez nagłówków i list.
- Odnieś się do konkretnych liczb: co poszło do przodu względem poprzednich sesji, co stoi lub spadło.
- Jeśli sesja była według planu: czy zakresy powtórzeń zostały zrobione i co aplikacja podpowie następnym razem (podpowiedź jest w danych — nie wymyślaj własnych ciężarów).
- Uwzględnij sen, tętno spoczynkowe i notatki dnia, jeśli mogą tłumaczyć słabszy lub lepszy wynik.
- Jeśli są oznaki problemu z barkiem lub innym ograniczeniem z briefu, zwróć na to uwagę.
Bez pochwał na wyrost i bez ogólników typu „świetna robota”.`;

const fmtSet = (s: PlannedSet, unit: "reps" | "sec") =>
  s.weightKg != null ? `${s.weightKg} kg × ${formatReps(s.reps, unit)}` : `${formatReps(s.reps, unit)} (masa ciała)`;

/** Builds the session description the model gets as input. */
async function describeSession(userId: string, workoutId: string) {
  const workout = await db.query.workouts.findFirst({
    where: and(eq(workouts.id, workoutId), eq(workouts.userId, userId)),
    with: { activityType: true, sets: { with: { exercise: true } } },
  });
  if (!workout || workout.activityType.healthKind !== "strength") return null;
  if (workout.sets.length === 0) return { workout, input: null, plan: null };

  const groups = groupSetsByExercise(workout.sets);
  const exerciseIds = groups.map((g) => g.exercise.id);

  const [plan, history, health, notes] = await Promise.all([
    loadTrainingPlan(userId),
    db
      .select({
        exerciseId: workoutSets.exerciseId,
        workoutId: workouts.id,
        date: workouts.date,
        reps: workoutSets.reps,
        weightKg: workoutSets.weightKg,
      })
      .from(workoutSets)
      .innerJoin(workouts, eq(workouts.id, workoutSets.workoutId))
      .where(
        and(
          eq(workouts.userId, userId),
          inArray(workoutSets.exerciseId, exerciseIds),
          ne(workouts.id, workout.id),
          lte(workouts.date, workout.date)
        )
      )
      .orderBy(desc(workouts.date), desc(workouts.createdAt), workoutSets.position),
    db.query.healthMetrics.findFirst({
      where: and(eq(healthMetrics.userId, userId), eq(healthMetrics.date, workout.date)),
    }),
    // The day itself and the days just before (a hike, a bad night) explain a session.
    db.query.dayNotes.findMany({
      where: and(
        eq(dayNotes.userId, userId),
        gte(dayNotes.date, toISODateString(subDays(parseISO(workout.date), NOTE_DAYS_BEFORE))),
        lte(dayNotes.date, workout.date)
      ),
      orderBy: [desc(dayNotes.date)],
    }),
  ]);

  // Newest PREVIOUS_SESSIONS sessions per exercise, rows already newest first.
  const previous = new Map<string, { workoutId: string; date: string; sets: PlannedSet[] }[]>();
  for (const row of history) {
    const sessions = previous.get(row.exerciseId) ?? [];
    const last = sessions.at(-1);
    const set = { reps: row.reps, weightKg: row.weightKg };
    if (last?.workoutId === row.workoutId) last.sets.push(set);
    else if (sessions.length < PREVIOUS_SESSIONS)
      sessions.push({ workoutId: row.workoutId, date: row.date, sets: [set] });
    previous.set(row.exerciseId, sessions);
  }

  const planDay = plan?.days.find((d) => d.id === workout.planDayId) ?? null;
  const lines = [
    `Data: ${workout.date}`,
    planDay ? `Dzień planu: ${planDay.label} — ${planDay.name}` : "Sesja bez dnia planu.",
  ];
  if (workout.duration) lines.push(`Czas: ${workout.duration} min`);
  if (workout.feelingScore) lines.push(`Samopoczucie: ${workout.feelingScore}/5`);
  if (workout.notes) lines.push(`Notatka: ${workout.notes}`);

  lines.push("", "Ćwiczenia (w kolejności wykonania):");
  for (const group of groups) {
    const { exercise } = group;
    const sets = group.sets.map((s) => ({ reps: s.reps, weightKg: s.weightKg }));
    lines.push(`- ${exercise.name}: ${sets.map((s) => fmtSet(s, exercise.unit)).join(", ")}`);
    const planned = planDay?.exercises.find((e) => e.exerciseId === exercise.id);
    if (planned) {
      const next = suggestSets(planned, sets, exercise.unit);
      lines.push(
        `  plan: ${planned.sets} × ${formatRepRange(planned, exercise.unit)}; ` +
          `podpowiedź aplikacji na następny raz: ${next.sets.map((s) => fmtSet(s, exercise.unit)).join(", ")}` +
          (next.hint ? ` (${next.hint})` : "")
      );
    }
    for (const session of previous.get(exercise.id) ?? []) {
      lines.push(`  ${session.date}: ${session.sets.map((s) => fmtSet(s, exercise.unit)).join(", ")}`);
    }
    if ((previous.get(exercise.id) ?? []).length === 0) lines.push("  (pierwszy raz)");
  }
  const skipped = planDay?.exercises.filter((e) => !exerciseIds.includes(e.exerciseId)) ?? [];
  if (skipped.length > 0) {
    lines.push("", `Pominięte z planu dnia: ${skipped.map((e) => e.exercise.name).join(", ")}`);
  }
  const checks = new Set(workout.planChecks ?? []);
  const checklist = plan?.checklist.filter((c) => c.section !== "home") ?? [];
  if (planDay && checklist.length > 0) {
    lines.push(
      `Rozgrzewka/cardio odhaczone: ${checklist.filter((c) => checks.has(c.id)).length} z ${checklist.length}`
    );
  }

  lines.push("", "Dzień:");
  if (health) {
    lines.push(
      `sen ${health.sleepHours ?? "?"} h, tętno spoczynkowe ${health.restingHr ?? "?"} bpm, ` +
        `minuty ćwiczeń (zegarek) ${health.exerciseMinutes ?? "?"}`
    );
  } else lines.push("brak danych z zegarka");
  const tagLabel = new Map<string, string>(DAY_TAGS.map((t) => [t.key, t.label]));
  for (const note of notes) {
    const tags = note.tags.map((t) => tagLabel.get(t) ?? t).join(", ");
    lines.push(`notatka ${note.date}: ${[tags, note.text].filter(Boolean).join(" — ")}`);
  }

  return { workout, input: lines.join("\n"), plan };
}

export type CommentResult = { comment: string } | { error: "not_found" | "no_sets" };

/** Generates the comment and stores it on the workout. */
export async function commentWorkout(
  userId: string,
  workoutId: string,
  { dryRun = false } = {}
): Promise<CommentResult & { usage?: { inputTokens: number; outputTokens: number }; input?: string }> {
  const session = await describeSession(userId, workoutId);
  if (!session) return { error: "not_found" };
  if (!session.input) return { error: "no_sets" };

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { coachBrief: true },
  });
  const system = [
    RULES,
    briefSection(user?.coachBrief?.trim() || null),
    session.plan ? `## Aktualny plan treningowy\n${formatPlan(session.plan)}` : "",
    `## Zadanie\n${TASK}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const call = (model: string) =>
    getAI().generateText({ model, system, input: session.input!, thinking: AI_THINKING.comment });
  const { text, usage } = dryRun
    ? await call(AI_MODELS.comment)
    : await withAICall(userId, "comment", call);

  if (!dryRun) {
    await db
      .update(workouts)
      .set({ aiComment: text, aiCommentAt: new Date() })
      .where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)));
  }
  return { comment: text, usage, input: session.input };
}
