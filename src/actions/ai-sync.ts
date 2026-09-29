"use server";

import { db } from "@/lib/db";
import { activityTypes, coachReports } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { updateTag } from "next/cache";
import { parseAITargets, type ParsedTarget } from "@/lib/ai-sync";

type SyncResult = { updated: string[]; skipped: string[] } | { error: string };

/**
 * Update `target_per_week` for the user's activity types matching the targets by
 * name (case-insensitive). Names with no matching activity come back in `skipped`.
 */
async function applyTargets(userId: string, targets: ParsedTarget[]) {
  const userTypes = await db.query.activityTypes.findMany({
    where: eq(activityTypes.userId, userId),
  });

  const byName = new Map(
    userTypes.map((t) => [t.name.trim().toLowerCase(), t])
  );

  const updated: string[] = [];
  const skipped: string[] = [];
  for (const target of targets) {
    const match = byName.get(target.name.toLowerCase());
    if (!match) {
      skipped.push(target.name);
      continue;
    }
    if (match.targetPerWeek === target.targetPerWeek) continue;

    await db
      .update(activityTypes)
      .set({ targetPerWeek: target.targetPerWeek })
      .where(
        and(
          eq(activityTypes.id, match.id),
          eq(activityTypes.userId, userId)
        )
      );
    updated.push(match.name);
  }

  if (updated.length > 0) {
    updateTag("activity-types");
  }

  return { updated, skipped };
}

/**
 * Parse a JSON payload pasted from the AI coach and update the matching targets.
 */
export async function syncAITargets(payload: string): Promise<SyncResult> {
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

  return applyTargets(session.user.id, targets);
}

/**
 * Apply the targets proposed in a report posted by the local AI coach.
 */
export async function applyReportTargets(reportId: string): Promise<SyncResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Nie jesteś zalogowany" };
  }
  const userId = session.user.id;

  const report = await db.query.coachReports.findFirst({
    where: and(eq(coachReports.id, reportId), eq(coachReports.userId, userId)),
  });
  if (!report?.targets?.length) {
    return { error: "Raport nie zawiera celów" };
  }
  if (report.appliedAt) {
    return { error: "Cele z tego raportu są już zastosowane" };
  }

  const result = await applyTargets(userId, report.targets);
  await db
    .update(coachReports)
    .set({ appliedAt: new Date() })
    .where(eq(coachReports.id, report.id));
  updateTag("coach-reports");

  return result;
}
