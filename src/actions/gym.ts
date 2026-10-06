"use server";

import { db } from "@/lib/db";
import {
  workouts,
  workoutSets,
  exercises,
  activityTypes,
  healthMetrics,
  dayNotes,
} from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { and, eq, inArray, sql } from "drizzle-orm";
import { v4 as uuid, validate as isUuid } from "uuid";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { GYM_PROMPT_MIN_MINUTES, exerciseKey } from "@/lib/gym";
import { DAY_NOTE_MAX_LENGTH, DAY_TAGS } from "@/lib/day-notes";

// Set and exercise ids are generated on the client, so an optimistic set (or a new
// exercise's "+ Seria") works before the server round-trip finishes. They're
// validated here like any other input.

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

// Ownership as a WHERE condition: a set write is one statement, not lookup + write.
function ownSet(userId: string, setId: string) {
  return and(
    eq(workoutSets.id, setId),
    inArray(
      workoutSets.workoutId,
      db.select({ id: workouts.id }).from(workouts).where(eq(workouts.userId, userId))
    )
  );
}

// Computed inside the INSERT, so it costs no extra round trip.
function nextPositionSql(workoutId: string) {
  return sql<number>`(select coalesce(max(${workoutSets.position}), -1) + 1 from ${workoutSets} where ${workoutSets.workoutId} = ${workoutId})`;
}

function checkSetValues(reps: number, weightKg: number | null) {
  if (!Number.isInteger(reps) || reps < 1 || reps > 999) {
    throw new Error("Nieprawidłowa liczba powtórzeń");
  }
  if (weightKg != null && (!Number.isFinite(weightKg) || weightKg < 0 || weightKg > 1000)) {
    throw new Error("Nieprawidłowy ciężar");
  }
}

function checkId(id: string) {
  if (!isUuid(id)) throw new Error("Nieprawidłowe id");
}

function cleanExerciseName(name: string) {
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean || clean.length > 80) throw new Error("Nieprawidłowa nazwa ćwiczenia");
  return clean;
}

// Adds an exercise (created on first use) with one set. The client resolves the name
// to an id and prefills the set from that exercise's last set, so nothing on screen
// changes when this returns.
export async function addExercise(
  workoutId: string,
  setId: string,
  exerciseId: string,
  name: string,
  reps: number,
  weightKg: number | null
) {
  const userId = await requireUserId();
  checkId(setId);
  checkId(exerciseId);
  checkSetValues(reps, weightKg);
  const cleanName = cleanExerciseName(name);

  // Sequential on purpose: a parallel libsql request opens a second connection,
  // which measured slower than two queries on the same one.
  await requireOwnWorkout(userId, workoutId);
  const own = await db.query.exercises.findMany({ where: eq(exercises.userId, userId) });
  // A name the user already has wins over a fresh client id (stale client list).
  const existing =
    own.find((e) => e.id === exerciseId) ??
    own.find((e) => exerciseKey(e.name) === exerciseKey(cleanName));
  const id = existing?.id ?? exerciseId;

  const insertSet = db.insert(workoutSets).values({
    id: setId,
    workoutId,
    exerciseId: id,
    position: nextPositionSql(workoutId),
    reps,
    weightKg,
  });
  if (existing) await insertSet;
  else await db.batch([db.insert(exercises).values({ id, userId, name: cleanName }), insertSet]);

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
  checkId(setId);
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
    position: nextPositionSql(workoutId),
    reps,
    weightKg,
  });

  updateTag("gym");
}

export async function updateSet(setId: string, reps: number, weightKg: number | null) {
  const userId = await requireUserId();
  checkSetValues(reps, weightKg);

  const result = await db
    .update(workoutSets)
    .set({ reps, weightKg })
    .where(ownSet(userId, setId));
  if (result.rowsAffected === 0) throw new Error("Nie znaleziono serii");
  updateTag("gym");
}

export async function deleteSet(setId: string) {
  const userId = await requireUserId();

  const result = await db.delete(workoutSets).where(ownSet(userId, setId));
  if (result.rowsAffected === 0) throw new Error("Nie znaleziono serii");
  updateTag("gym");
}

// Renames an exercise everywhere (fixing a typo fixes the history too). Renaming to
// a name the user already has merges the two: sets move over, the duplicate goes.
export async function renameExercise(exerciseId: string, name: string) {
  const userId = await requireUserId();
  const cleanName = cleanExerciseName(name);

  const own = await db.query.exercises.findMany({ where: eq(exercises.userId, userId) });
  const exercise = own.find((e) => e.id === exerciseId);
  if (!exercise) throw new Error("Nie znaleziono ćwiczenia");
  const twin = own.find(
    (e) => e.id !== exerciseId && exerciseKey(e.name) === exerciseKey(cleanName)
  );

  if (twin) {
    await db.batch([
      db
        .update(workoutSets)
        .set({ exerciseId: twin.id })
        .where(eq(workoutSets.exerciseId, exerciseId)),
      db.delete(exercises).where(eq(exercises.id, exerciseId)),
    ]);
  } else if (exercise.name !== cleanName) {
    await db.update(exercises).set({ name: cleanName }).where(eq(exercises.id, exerciseId));
  }

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
// enough exercise minutes, then opens it. Redirecting from the action renders the
// workout page in the same response — no second round trip after the action.
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
  redirect(`/trening/${id}`);
}

// "No, it wasn't the gym". An optional answer to "what was it?" (a hike, a walk) is
// merged into that day's note — tag "extra_activity" plus the text — so the AI coach
// can explain the exercise minutes. An existing note is extended, never replaced.
export async function dismissGymPrompt(date: string, what = "") {
  const userId = await requireUserId();

  const result = await db
    .update(healthMetrics)
    .set({ gymPromptDismissed: true })
    .where(and(eq(healthMetrics.userId, userId), eq(healthMetrics.date, date)));
  updateTag("health-metrics");

  // Only days the watch reported can be answered, so `date` is a real day here.
  const answer = what.trim().replace(/\s+/g, " ");
  if (!answer || result.rowsAffected === 0) return;

  const existing = await db.query.dayNotes.findFirst({
    where: and(eq(dayNotes.userId, userId), eq(dayNotes.date, date)),
  });
  const known = [...(existing?.tags ?? []), "extra_activity"];
  const tags: string[] = DAY_TAGS.map((t) => t.key).filter((key) => known.includes(key));
  const text = (existing?.text ? `${existing.text}\n${answer}` : answer).slice(
    0,
    DAY_NOTE_MAX_LENGTH
  );

  await db
    .insert(dayNotes)
    .values({ id: uuid(), userId, date, tags, text })
    .onConflictDoUpdate({
      target: [dayNotes.userId, dayNotes.date],
      set: { tags, text, updatedAt: new Date() },
    });
  updateTag("day-notes");
}
