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
} from "@/lib/db/schema";
import { eq, and, gte, lte, ne, desc, sql, inArray } from "drizzle-orm";
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
export async function getCachedExercises(userId: string) {
  "use cache";
  cacheTag("gym");
  cacheLife("hours");

  const lastUsed = sql<string | null>`max(${workouts.date})`;
  return db
    .select({ id: exercises.id, name: exercises.name, lastUsed })
    .from(exercises)
    .leftJoin(workoutSets, eq(workoutSets.exerciseId, exercises.id))
    .leftJoin(workouts, eq(workouts.id, workoutSets.workoutId))
    .where(eq(exercises.userId, userId))
    .groupBy(exercises.id)
    .orderBy(sql`${lastUsed} is null`, desc(lastUsed), exercises.name);
}

// The latest other strength workout on or before `date` that has sets —
// the source for "copy exercises from last time".
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
