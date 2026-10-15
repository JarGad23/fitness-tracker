"use server";

import { eq } from "drizzle-orm";
import { updateTag } from "next/cache";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { COACH_BRIEF_MAX_LENGTH } from "@/lib/ai/limits";
import { aiErrorMessage } from "@/lib/ai/provider";
import { generateWeeklyReport } from "@/lib/ai/report";
import { commentWorkout } from "@/lib/ai/comment";
import { todayISO } from "@/lib/utils";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Nie jesteś zalogowany");
  return session.user.id;
}

export async function saveCoachBrief(text: string) {
  const userId = await requireUserId();
  if (text.length > COACH_BRIEF_MAX_LENGTH) throw new Error("Brief jest za długi");
  await db
    .update(users)
    .set({ coachBrief: text.trim() || null })
    .where(eq(users.id, userId));
  updateTag("coach-brief");
}

export async function generateReportNow(): Promise<{ ok: true } | { error: string }> {
  const userId = await requireUserId();
  try {
    await generateWeeklyReport(userId, todayISO());
  } catch (error) {
    console.error("generateReportNow failed:", error);
    return { error: aiErrorMessage(error) };
  }
  updateTag("coach-reports");
  return { ok: true };
}

export async function commentWorkoutNow(
  workoutId: string
): Promise<{ comment: string } | { error: string }> {
  const userId = await requireUserId();
  let result;
  try {
    result = await commentWorkout(userId, workoutId);
  } catch (error) {
    console.error("commentWorkoutNow failed:", error);
    return { error: aiErrorMessage(error) };
  }
  if ("error" in result) {
    return {
      error: result.error === "no_sets" ? "Najpierw zapisz serie" : "Nie znaleziono treningu",
    };
  }
  updateTag("gym");
  return { comment: result.comment };
}
