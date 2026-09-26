"use server";

import { db } from "@/lib/db";
import {
  workouts,
  workoutSets,
  exercises,
  activityTypes,
  healthMetrics,
} from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { and, eq, max } from "drizzle-orm";
import { v4 as uuid, validate as isUuid } from "uuid";
import { updateTag } from "next/cache";
import { DEFAULT_REPS, GYM_PROMPT_MIN_MINUTES, exerciseKey } from "@/lib/gym";

// Set ids are generated on the client so an optimistic set can be edited before
// the server round-trip finishes. They're validated here like any other input.

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Nie jesteś zalogowany");
  return session.user.id;
}

async function requireOwnWorkout(userId: string, workoutId: string) {
  const workout = await db.query.workouts.findFirst({
    where: and(eq(workouts.id, workoutId), eq(workouts.userId, userId)),
  });
  if (!workout) throw new Error("Nie znaleziono treningu");
  return workout;
}

async function requireOwnSet(userId: string, setId: string) {
  const set = await db.query.workoutSets.findFirst({
    where: eq(workoutSets.id, setId),
    with: { workout: true },
  });
  if (!set || set.workout.userId !== userId) throw new Error("Nie znaleziono serii");
  return set;
}

async function nextPosition(workoutId: string) {
  const [row] = await db
    .select({ value: max(workoutSets.position) })
    .from(workoutSets)
    .where(eq(workoutSets.workoutId, workoutId));
  return (row?.value ?? -1) + 1;
}

function checkSetValues(reps: number, weightKg: number | null) {
  if (!Number.isInteger(reps) || reps < 1 || reps > 999) {
    throw new Error("Nieprawidłowa liczba powtórzeń");
  }
  if (weightKg != null && (!Number.isFinite(weightKg) || weightKg < 0 || weightKg > 1000)) {
    throw new Error("Nieprawidłowy ciężar");
  }
}

function checkSetId(setId: string) {
  if (!isUuid(setId)) throw new Error("Nieprawidłowe id serii");
}

// Adds an exercise (created on first use) with one set. The set starts from the
// last set of that exercise in any earlier workout, so the usual weight is prefilled.
export async function addExercise(workoutId: string, setId: string, name: string) {
  const userId = await requireUserId();
  checkSetId(setId);
  await requireOwnWorkout(userId, workoutId);

  const cleanName = name.trim().replace(/\s+/g, " ");
  if (!cleanName || cleanName.length > 80) throw new Error("Nieprawidłowa nazwa ćwiczenia");

  const own = await db.query.exercises.findMany({ where: eq(exercises.userId, userId) });
  let exercise = own.find((e) => exerciseKey(e.name) === exerciseKey(cleanName));
  if (!exercise) {
    exercise = { id: uuid(), userId, name: cleanName, createdAt: new Date() };
    await db.insert(exercises).values(exercise);
  }

  const previous = await db
    .select({ reps: workoutSets.reps, weightKg: workoutSets.weightKg })
    .from(workoutSets)
    .innerJoin(workouts, eq(workouts.id, workoutSets.workoutId))
    .where(eq(workoutSets.exerciseId, exercise.id))
    .orderBy(workouts.date, workoutSets.position)
    .then((rows) => rows.at(-1));

  await db.insert(workoutSets).values({
    id: setId,
    workoutId,
    exerciseId: exercise.id,
    position: await nextPosition(workoutId),
    reps: previous?.reps ?? DEFAULT_REPS,
    weightKg: previous?.weightKg ?? null,
  });

  updateTag("gym");
}

export async function addSet(
  workoutId: string,
  setId: string,
  exerciseId: string,
  reps: number,
  weightKg: number | null
) {
  const userId = await requireUserId();
  checkSetId(setId);
  checkSetValues(reps, weightKg);
  await requireOwnWorkout(userId, workoutId);

  const exercise = await db.query.exercises.findFirst({
    where: and(eq(exercises.id, exerciseId), eq(exercises.userId, userId)),
  });
  if (!exercise) throw new Error("Nie znaleziono ćwiczenia");

  await db.insert(workoutSets).values({
    id: setId,
    workoutId,
    exerciseId,
    position: await nextPosition(workoutId),
    reps,
    weightKg,
  });

  updateTag("gym");
}

export async function updateSet(setId: string, reps: number, weightKg: number | null) {
  const userId = await requireUserId();
  checkSetValues(reps, weightKg);
  await requireOwnSet(userId, setId);

  await db.update(workoutSets).set({ reps, weightKg }).where(eq(workoutSets.id, setId));
  updateTag("gym");
}

export async function deleteSet(setId: string) {
  const userId = await requireUserId();
  await requireOwnSet(userId, setId);

  await db.delete(workoutSets).where(eq(workoutSets.id, setId));
  updateTag("gym");
}

// "Repeat last": copies every set of a previous session into an empty workout.
export async function copySetsFrom(workoutId: string, sourceWorkoutId: string) {
  const userId = await requireUserId();
  await requireOwnWorkout(userId, workoutId);
  await requireOwnWorkout(userId, sourceWorkoutId);

  const existing = await db.query.workoutSets.findFirst({
    where: eq(workoutSets.workoutId, workoutId),
  });
  if (existing) throw new Error("Trening ma już serie");

  const source = await db.query.workoutSets.findMany({
    where: eq(workoutSets.workoutId, sourceWorkoutId),
  });
  if (source.length === 0) return;

  await db.insert(workoutSets).values(
    source.map((s) => ({
      id: uuid(),
      workoutId,
      exerciseId: s.exerciseId,
      position: s.position,
      reps: s.reps,
      weightKg: s.weightKg,
    }))
  );
  updateTag("gym");
}

// "Yes, that was the gym" — logs a strength workout for a day the watch saw
// enough exercise minutes. Returns the workout id so the client can open it.
export async function confirmGymPrompt(date: string) {
  const userId = await requireUserId();

  const [metrics, strength, dayWorkout] = await Promise.all([
    db.query.healthMetrics.findFirst({
      where: and(eq(healthMetrics.userId, userId), eq(healthMetrics.date, date)),
    }),
    db.query.activityTypes.findFirst({
      where: and(eq(activityTypes.userId, userId), eq(activityTypes.healthKind, "strength")),
    }),
    db.query.workouts.findFirst({
      where: and(eq(workouts.userId, userId), eq(workouts.date, date)),
    }),
  ]);
  const minutes = metrics?.exerciseMinutes ?? 0;
  if (!strength || minutes < GYM_PROMPT_MIN_MINUTES || dayWorkout) {
    throw new Error("Ten dzień nie czeka na potwierdzenie");
  }

  const id = uuid();
  await db.insert(workouts).values({
    id,
    userId,
    activityTypeId: strength.id,
    date,
    notes: `Apple Watch · ${minutes} min ćwiczeń`,
    source: "watch",
  });

  updateTag("workouts");
  return id;
}

export async function dismissGymPrompt(date: string) {
  const userId = await requireUserId();

  await db
    .update(healthMetrics)
    .set({ gymPromptDismissed: true })
    .where(and(eq(healthMetrics.userId, userId), eq(healthMetrics.date, date)));

  updateTag("health-metrics");
}
