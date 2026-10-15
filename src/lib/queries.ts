import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import {
  workouts,
  activityTypes,
  healthMetrics,
  exercises,
  workoutSets,
  coachReports,
  dayNotes,
  trainingPlans,
  users,
  planRevisions,
} from "@/lib/db/schema";
import { eq, and, gte, lte, ne, desc, sql, inArray, isNotNull } from "drizzle-orm";
import { GYM_PROMPT_MIN_MINUTES } from "@/lib/gym";

// Runtime auth (cookies) is read by the caller and the user id is passed in as an
// argument, so it becomes part of the cache key. This is the pattern Next.js
// recommends over `use cache: private` (which is experimental and browser-only).

export async function getCachedActivityTypes(userId: string) {
  "use cache";
  cacheTag("activity-types");
  // Long stale is safe: every mutation calls updateTag("activity-types"),
  // so changes invalidate immediately rather than waiting for revalidation.
  cacheLife("days");

  return db.query.activityTypes.findMany({
    where: eq(activityTypes.userId, userId),
    orderBy: (activityTypes, { asc }) => [asc(activityTypes.sortOrder)],
  });
}

export async function getCachedWorkoutsInRange(
  userId: string,
  startDate: string,
  endDate: string
) {
  "use cache";
  cacheTag("workouts");
  // Long stale is safe: add/deleteWorkout call updateTag("workouts").
  cacheLife("hours");

  return db.query.workouts.findMany({
    where: and(
      eq(workouts.userId, userId),
      gte(workouts.date, startDate),
      lte(workouts.date, endDate)
    ),
    with: {
      activityType: true,
    },
    orderBy: (workouts, { asc }) => [asc(workouts.date), asc(workouts.createdAt)],
  });
}

export async function getCachedHealthMetricsInRange(
  userId: string,
  startDate: string,
  endDate: string
) {
  "use cache";
  cacheTag("health-metrics");
  // Long stale is safe: the /api/watch-sync webhook calls revalidateTag("health-metrics").
  cacheLife("hours");

  return db.query.healthMetrics.findMany({
    where: and(
      eq(healthMetrics.userId, userId),
      gte(healthMetrics.date, startDate),
      lte(healthMetrics.date, endDate)
    ),
    orderBy: (healthMetrics, { asc }) => [asc(healthMetrics.date)],
  });
}

// Long stale is safe: saveDayNote calls updateTag("day-notes").
export async function getCachedDayNotesInRange(
  userId: string,
  startDate: string,
  endDate: string
) {
  "use cache";
  cacheTag("day-notes");
  cacheLife("hours");

  return db.query.dayNotes.findMany({
    where: and(
      eq(dayNotes.userId, userId),
      gte(dayNotes.date, startDate),
      lte(dayNotes.date, endDate)
    ),
    orderBy: (dayNotes, { asc }) => [asc(dayNotes.date)],
  });
}

// --- Gym ---------------------------------------------------------------------
// Set mutations (src/actions/gym.ts) call updateTag("gym"); workout-level changes
// call updateTag("workouts"), so both tags are attached where both matter.

export async function getCachedWorkoutWithSets(userId: string, workoutId: string) {
  "use cache";
  cacheTag("gym", "workouts");
  cacheLife("hours");

  return db.query.workouts.findFirst({
    where: and(eq(workouts.id, workoutId), eq(workouts.userId, userId)),
    with: {
      activityType: true,
      sets: { with: { exercise: true } },
    },
  });
}

// Most recently used first, never-used ones last (alphabetical).
export async function getCachedExercises(
  userId: string,
  workoutId: string,
  workoutDate: string
) {
  "use cache";
  cacheTag("gym");
  cacheLife("hours");

  // The newest set of each exercise in another workout up to this one's date: prefills
  // a new set and feeds the "Ostatnio" line (backfilling an old day never shows a later
  // session). Correlated subqueries keep it one round trip.
  const last = (column: "w.date" | "s.reps" | "s.weight_kg") =>
    sql`(select ${sql.raw(column)} from workout_sets s join workouts w on w.id = s.workout_id
      where s.exercise_id = ${exercises.id} and w.id <> ${workoutId} and w.date <= ${workoutDate}
      order by w.date desc, w.created_at desc, s.position desc limit 1)`;

  const rows = await db
    .select({
      id: exercises.id,
      name: exercises.name,
      unit: exercises.unit,
      lastDate: sql<string | null>`${last("w.date")}`,
      lastReps: sql<number | null>`${last("s.reps")}`,
      lastWeightKg: sql<number | null>`${last("s.weight_kg")}`,
    })
    .from(exercises)
    .where(eq(exercises.userId, userId));

  return rows.sort(
    (a, b) =>
      (b.lastDate ?? "").localeCompare(a.lastDate ?? "") || a.name.localeCompare(b.name, "pl")
  );
}

export async function getCachedPreviousStrengthSession(
  userId: string,
  workoutId: string,
  date: string
) {
  "use cache";
  cacheTag("gym", "workouts");
  cacheLife("hours");

  return db.query.workouts.findFirst({
    where: and(
      eq(workouts.userId, userId),
      ne(workouts.id, workoutId),
      lte(workouts.date, date),
      inArray(
        workouts.activityTypeId,
        db
          .select({ id: activityTypes.id })
          .from(activityTypes)
          .where(
            and(eq(activityTypes.userId, userId), eq(activityTypes.healthKind, "strength"))
          )
      ),
      // Subquery builder, not raw sql: inside a relational query drizzle rewrites
      // raw column refs to the root table alias (workout_sets.x → workouts.x).
      inArray(workouts.id, db.selectDistinct({ id: workoutSets.workoutId }).from(workoutSets))
    ),
    with: { sets: { with: { exercise: true } } },
    orderBy: [desc(workouts.date), desc(workouts.createdAt)],
  });
}

export async function getCachedExerciseHistory(userId: string, exerciseId: string) {
  "use cache";
  cacheTag("gym", "workouts");
  cacheLife("hours");

  const exercise = await db.query.exercises.findFirst({
    where: and(eq(exercises.id, exerciseId), eq(exercises.userId, userId)),
  });
  if (!exercise) return null;

  const rows = await db
    .select({
      workoutId: workouts.id,
      date: workouts.date,
      reps: workoutSets.reps,
      weightKg: workoutSets.weightKg,
    })
    .from(workoutSets)
    .innerJoin(workouts, eq(workouts.id, workoutSets.workoutId))
    .where(eq(workoutSets.exerciseId, exerciseId))
    .orderBy(desc(workouts.date), desc(workouts.createdAt), workoutSets.position);

  const sessions: { workoutId: string; date: string; sets: { reps: number; weightKg: number | null }[] }[] = [];
  for (const row of rows) {
    const last = sessions.at(-1);
    const set = { reps: row.reps, weightKg: row.weightKg };
    if (last?.workoutId === row.workoutId) last.sets.push(set);
    else sessions.push({ workoutId: row.workoutId, date: row.date, sets: [set] });
  }
  return { exercise, sessions };
}

// Days in range with enough watch exercise minutes, no workout of any kind, and
// no "no" answer yet. Empty if the user has no strength activity to confirm into.
export async function getCachedGymPrompts(
  userId: string,
  startDate: string,
  endDate: string
) {
  "use cache";
  cacheTag("health-metrics", "workouts", "activity-types");
  cacheLife("hours");

  const strength = await db.query.activityTypes.findFirst({
    where: and(eq(activityTypes.userId, userId), eq(activityTypes.healthKind, "strength")),
  });
  if (!strength) return [];

  return db
    .select({ date: healthMetrics.date, minutes: healthMetrics.exerciseMinutes })
    .from(healthMetrics)
    .where(
      and(
        eq(healthMetrics.userId, userId),
        gte(healthMetrics.date, startDate),
        lte(healthMetrics.date, endDate),
        gte(healthMetrics.exerciseMinutes, GYM_PROMPT_MIN_MINUTES),
        eq(healthMetrics.gymPromptDismissed, false),
        sql`not exists (select 1 from ${workouts} where ${workouts.userId} = ${userId} and ${workouts.date} = ${healthMetrics.date})`
      )
    )
    .orderBy(healthMetrics.date);
}

// --- Training plan ------------------------------------------------------------------

// The newest plan with days, exercises and checklist in order. Tagged "gym" too: an
// exercise rename/merge changes what the plan shows. The seed script writes directly,
// so restart dev (or wait out cacheLife) after seeding.
export async function getCachedTrainingPlan(userId: string) {
  "use cache";
  cacheTag("plan", "gym");
  cacheLife("hours");

  const plan = await db.query.trainingPlans.findFirst({
    where: eq(trainingPlans.userId, userId),
    orderBy: [desc(trainingPlans.createdAt)],
    with: {
      days: {
        orderBy: (d, { asc }) => [asc(d.position)],
        with: {
          exercises: {
            orderBy: (e, { asc }) => [asc(e.position)],
            with: { exercise: true },
          },
        },
      },
      checklist: { orderBy: (c, { asc }) => [asc(c.position)] },
    },
  });
  return plan ?? null;
}

export type TrainingPlanFull = NonNullable<Awaited<ReturnType<typeof getCachedTrainingPlan>>>;

// Plan day of the newest session that followed the plan: the rotation continues from it.
export async function getCachedLastPlanDayId(userId: string) {
  "use cache";
  cacheTag("workouts");
  cacheLife("hours");

  const [row] = await db
    .select({ planDayId: workouts.planDayId })
    .from(workouts)
    .where(and(eq(workouts.userId, userId), isNotNull(workouts.planDayId)))
    .orderBy(desc(workouts.date), desc(workouts.createdAt))
    .limit(1);
  return row?.planDayId ?? null;
}

// Per exercise: every set of its newest session before this workout (up to its date),
// for the double-progression suggestion.
export async function getCachedLastSessionSets(
  userId: string,
  workoutId: string,
  date: string,
  exerciseIds: string[]
) {
  "use cache";
  cacheTag("gym", "workouts");
  cacheLife("hours");

  if (exerciseIds.length === 0) return {};
  const rows = await db
    .select({
      exerciseId: workoutSets.exerciseId,
      workoutId: workouts.id,
      reps: workoutSets.reps,
      weightKg: workoutSets.weightKg,
    })
    .from(workoutSets)
    .innerJoin(workouts, eq(workouts.id, workoutSets.workoutId))
    .where(
      and(
        eq(workouts.userId, userId),
        ne(workouts.id, workoutId),
        lte(workouts.date, date),
        inArray(workoutSets.exerciseId, exerciseIds)
      )
    )
    .orderBy(desc(workouts.date), desc(workouts.createdAt), workoutSets.position);

  // Rows come newest session first: keep only the first session seen per exercise.
  const result: Record<string, { reps: number; weightKg: number | null }[]> = {};
  const sessionOf: Record<string, string> = {};
  for (const row of rows) {
    sessionOf[row.exerciseId] ??= row.workoutId;
    if (sessionOf[row.exerciseId] !== row.workoutId) continue;
    (result[row.exerciseId] ??= []).push({ reps: row.reps, weightKg: row.weightKg });
  }
  return result;
}

// --- AI coach API ---------------------------------------------------------------

// Workouts with their gym sets, for the /api/ai/context export.
export async function getCachedWorkoutsWithSetsInRange(
  userId: string,
  startDate: string,
  endDate: string
) {
  "use cache";
  cacheTag("workouts", "gym");
  cacheLife("hours");

  return db.query.workouts.findMany({
    where: and(
      eq(workouts.userId, userId),
      gte(workouts.date, startDate),
      lte(workouts.date, endDate)
    ),
    with: { activityType: true, sets: { with: { exercise: true } } },
    orderBy: (workouts, { asc }) => [asc(workouts.date), asc(workouts.createdAt)],
  });
}

// Long stale is safe: POST /api/ai/reports calls revalidateTag("coach-reports") and
// applying a report's targets calls updateTag("coach-reports").
export async function getCachedLatestCoachReport(userId: string) {
  "use cache";
  cacheTag("coach-reports");
  cacheLife("hours");

  const report = await db.query.coachReports.findFirst({
    where: eq(coachReports.userId, userId),
    orderBy: [desc(coachReports.createdAt)],
  });
  return report ?? null;
}

// Long stale is safe: saveCoachBrief calls updateTag("coach-brief").
export async function getCachedCoachBrief(userId: string) {
  "use cache";
  cacheTag("coach-brief");
  cacheLife("days");

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { coachBrief: true },
  });
  return user?.coachBrief ?? null;
}

// Long stale is safe: every revision action calls updateTag("plan-revisions").
export async function getCachedLatestPlanRevision(userId: string) {
  "use cache";
  cacheTag("plan-revisions");
  cacheLife("hours");

  const revision = await db.query.planRevisions.findFirst({
    where: eq(planRevisions.userId, userId),
    orderBy: [desc(planRevisions.createdAt)],
  });
  return revision ?? null;
}
