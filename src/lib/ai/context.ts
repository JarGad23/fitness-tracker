import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  activityTypes,
  coachReports,
  dayNotes,
  healthMetrics,
  trainingPlans,
  users,
  workouts,
} from "@/lib/db/schema";
import { buildAIContext, contextWeekRanges } from "@/lib/ai-context";
import { formatRepRange } from "@/lib/plan";

// Everything the AI coach knows about a user, read straight from the DB. Not the
// "use cache" queries: AI calls are rare, and this also runs in scripts outside Next.

export async function loadTrainingPlan(userId: string) {
  const plan = await db.query.trainingPlans.findFirst({
    where: eq(trainingPlans.userId, userId),
    orderBy: [desc(trainingPlans.createdAt)],
    with: {
      days: {
        orderBy: (d, { asc }) => [asc(d.position)],
        with: {
          exercises: { orderBy: (e, { asc }) => [asc(e.position)], with: { exercise: true } },
        },
      },
      checklist: { orderBy: (c, { asc }) => [asc(c.position)] },
    },
  });
  return plan ?? null;
}

export type LoadedPlan = NonNullable<Awaited<ReturnType<typeof loadTrainingPlan>>>;

/** The plan as readable text: days, exercises with sets × reps, checklist, rules. */
export function formatPlan(plan: LoadedPlan, { withIds = false } = {}) {
  const since = plan.createdAt.toISOString().slice(0, 10);
  const lines = [
    `Plan: ${plan.name}`,
    `Obowiązuje od ${since}. Treningów sprzed tej daty nie oceniaj względem planu — wtedy go jeszcze nie było.`,
  ];
  for (const day of plan.days) {
    lines.push("", `Dzień ${day.label} — ${day.name}`);
    day.exercises.forEach((e, i) => {
      const id = withIds ? ` [id: ${e.id}]` : "";
      const superset = e.superset != null ? ` (superseria ${e.superset})` : "";
      lines.push(
        `${i + 1}. ${e.exercise.name}: ${e.sets} × ${formatRepRange(e, e.exercise.unit)}${superset}${id}`
      );
      if (e.alternative) lines.push(`   zamiennik: ${e.alternative}`);
      if (e.tips) lines.push(`   wskazówki: ${e.tips}`);
    });
  }
  const sections = { warmup: "Rozgrzewka", cardio: "Cardio po treningu", home: "Domowy pakiet" };
  for (const [section, title] of Object.entries(sections)) {
    const items = plan.checklist.filter((c) => c.section === section);
    if (items.length === 0) continue;
    lines.push("", `${title}:`);
    for (const item of items) lines.push(`- ${item.title}${item.detail ? ` — ${item.detail}` : ""}`);
  }
  for (const note of plan.notes) lines.push("", `${note.title}:`, note.body);
  return lines.join("\n");
}

export async function loadCoachContext(userId: string, today: string, weeks: number) {
  const ranges = contextWeekRanges(today, weeks);
  const start = ranges[0].start;
  const end = ranges[ranges.length - 1].end;

  const [user, types, workoutRows, health, notes, latestReport, plan] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, userId), columns: { coachBrief: true } }),
    db.query.activityTypes.findMany({
      where: eq(activityTypes.userId, userId),
      orderBy: (t, { asc }) => [asc(t.sortOrder)],
    }),
    db.query.workouts.findMany({
      where: and(eq(workouts.userId, userId), gte(workouts.date, start), lte(workouts.date, end)),
      with: { activityType: true, sets: { with: { exercise: true } } },
      orderBy: (w, { asc }) => [asc(w.date), asc(w.createdAt)],
    }),
    db.query.healthMetrics.findMany({
      where: and(
        eq(healthMetrics.userId, userId),
        gte(healthMetrics.date, start),
        lte(healthMetrics.date, end)
      ),
      orderBy: (h, { asc }) => [asc(h.date)],
    }),
    db.query.dayNotes.findMany({
      where: and(eq(dayNotes.userId, userId), gte(dayNotes.date, start), lte(dayNotes.date, end)),
      orderBy: (n, { asc }) => [asc(n.date)],
    }),
    db.query.coachReports.findFirst({
      where: eq(coachReports.userId, userId),
      orderBy: [desc(coachReports.createdAt)],
    }),
    loadTrainingPlan(userId),
  ]);

  return {
    brief: user?.coachBrief?.trim() || null,
    plan,
    activityTypes: types,
    data: buildAIContext({
      today,
      weeks,
      activityTypes: types,
      workouts: workoutRows,
      healthMetrics: health,
      dayNotes: notes,
      latestReport: latestReport ?? null,
    }),
  };
}

export type CoachContext = Awaited<ReturnType<typeof loadCoachContext>>;
