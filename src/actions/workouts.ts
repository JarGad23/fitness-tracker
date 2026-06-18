"use server";

import { db } from "@/lib/db";
import { workouts, activityTypes } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq, and, gte, lte } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { updateTag } from "next/cache";

export async function getWeekWorkouts(startDate: string, endDate: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Nie jesteś zalogowany");
  }

  const result = await db.query.workouts.findMany({
    where: and(
      eq(workouts.userId, session.user.id),
      gte(workouts.date, startDate),
      lte(workouts.date, endDate)
    ),
    with: {
      activityType: true,
    },
    orderBy: (workouts, { asc }) => [asc(workouts.date), asc(workouts.createdAt)],
  });

  return result;
}

export async function addWorkout(
  activityTypeId: string,
  date: string,
  notes?: string,
  duration?: string
) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Nie jesteś zalogowany");
  }

  const activityType = await db.query.activityTypes.findFirst({
    where: and(
      eq(activityTypes.id, activityTypeId),
      eq(activityTypes.userId, session.user.id)
    ),
  });

  if (!activityType) {
    throw new Error("Nie znaleziono typu aktywności");
  }

  await db.insert(workouts).values({
    id: uuid(),
    userId: session.user.id,
    activityTypeId,
    date,
    notes: notes || null,
    duration: duration || null,
  });

  updateTag("workouts");
}

export async function deleteWorkout(workoutId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Nie jesteś zalogowany");
  }

  await db
    .delete(workouts)
    .where(
      and(eq(workouts.id, workoutId), eq(workouts.userId, session.user.id))
    );

  updateTag("workouts");
}

export async function getActivityTypes() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Nie jesteś zalogowany");
  }

  const result = await db.query.activityTypes.findMany({
    where: eq(activityTypes.userId, session.user.id),
    orderBy: (activityTypes, { asc }) => [asc(activityTypes.sortOrder)],
  });

  return result;
}
