"use server";

import { eq } from "drizzle-orm";
import { updateTag } from "next/cache";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { COACH_BRIEF_MAX_LENGTH } from "@/lib/ai/limits";

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
