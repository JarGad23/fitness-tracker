"use server";

import { db } from "@/lib/db";
import { activityTypes } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { updateTag } from "next/cache";

export async function createActivityType(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Nie jesteś zalogowany" };
  }

  const name = formData.get("name") as string;
  const targetPerWeek = parseInt(formData.get("targetPerWeek") as string);
  const icon = formData.get("icon") as string;

  if (!name || !targetPerWeek || !icon) {
    return { error: "Wszystkie pola są wymagane" };
  }

  const existingTypes = await db.query.activityTypes.findMany({
    where: eq(activityTypes.userId, session.user.id),
  });

  const maxSortOrder = Math.max(...existingTypes.map((t) => t.sortOrder), -1);

  await db.insert(activityTypes).values({
    id: uuid(),
    userId: session.user.id,
    name,
    targetPerWeek,
    icon,
    sortOrder: maxSortOrder + 1,
  });

  updateTag("activity-types");
}

export async function updateActivityType(
  id: string,
  formData: FormData
) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Nie jesteś zalogowany" };
  }

  const name = formData.get("name") as string;
  const targetPerWeek = parseInt(formData.get("targetPerWeek") as string);
  const icon = formData.get("icon") as string;

  if (!name || !targetPerWeek || !icon) {
    return { error: "Wszystkie pola są wymagane" };
  }

  await db
    .update(activityTypes)
    .set({ name, targetPerWeek, icon })
    .where(
      and(
        eq(activityTypes.id, id),
        eq(activityTypes.userId, session.user.id)
      )
    );

  updateTag("activity-types");
}

export async function deleteActivityType(id: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Nie jesteś zalogowany" };
  }

  await db
    .delete(activityTypes)
    .where(
      and(
        eq(activityTypes.id, id),
        eq(activityTypes.userId, session.user.id)
      )
    );

  updateTag("activity-types");
  updateTag("workouts");
}
