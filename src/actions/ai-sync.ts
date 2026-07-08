"use server";

import { db } from "@/lib/db";
import { activityTypes } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { updateTag } from "next/cache";
import { parseAITargets } from "@/lib/ai-sync";

/**
 * Parse a JSON payload pasted from the AI coach and update `target_per_week`
 * for the user's matching activity types (matched by name, case-insensitive).
 */
export async function syncAITargets(
  payload: string
): Promise<{ updated: string[] } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Nie jesteś zalogowany" };
  }

  let targets;
  try {
    targets = parseAITargets(payload);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Nie udało się sparsować danych",
    };
  }

  const userTypes = await db.query.activityTypes.findMany({
    where: eq(activityTypes.userId, session.user.id),
  });

  const byName = new Map(
    userTypes.map((t) => [t.name.trim().toLowerCase(), t])
  );

  const updated: string[] = [];
  for (const target of targets) {
    const match = byName.get(target.name.toLowerCase());
    if (!match || match.targetPerWeek === target.targetPerWeek) continue;

    await db
      .update(activityTypes)
      .set({ targetPerWeek: target.targetPerWeek })
      .where(
        and(
          eq(activityTypes.id, match.id),
          eq(activityTypes.userId, session.user.id)
        )
      );
    updated.push(match.name);
  }

  if (updated.length > 0) {
    updateTag("activity-types");
  }

  return { updated };
}
