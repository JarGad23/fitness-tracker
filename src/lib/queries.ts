import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { workouts, activityTypes } from "@/lib/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function getCachedActivityTypes() {
  "use cache: private";
  cacheTag("activity-types");
  cacheLife("hours");

  const session = await auth();
  if (!session?.user?.id) {
    return [];
  }

  return db.query.activityTypes.findMany({
    where: eq(activityTypes.userId, session.user.id),
    orderBy: (activityTypes, { asc }) => [asc(activityTypes.sortOrder)],
  });
}

export async function getCachedWeekWorkouts(startDate: string, endDate: string) {
  "use cache: private";
  cacheTag("workouts");
  cacheLife("minutes");

  const session = await auth();
  if (!session?.user?.id) {
    return [];
  }

  return db.query.workouts.findMany({
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
}
