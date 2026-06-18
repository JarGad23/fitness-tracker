import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { workouts, activityTypes } from "@/lib/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";

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
