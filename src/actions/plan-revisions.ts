"use server";

import { and, eq } from "drizzle-orm";
import { updateTag } from "next/cache";
import { v4 as uuid } from "uuid";
import type { BatchItem } from "drizzle-orm/batch";
import { db } from "@/lib/db";
import { exercises, planExercises, planRevisions, type PlanChange } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { loadTrainingPlan } from "@/lib/ai/context";
import { generatePlanRevision } from "@/lib/ai/plan-revision";
import { MAX_REQUEST_LENGTH } from "@/lib/plan-revision-view";
import { aiErrorMessage } from "@/lib/ai/provider";
import { exerciseKey, findSimilarExercise } from "@/lib/gym";
import { todayISO } from "@/lib/utils";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Nie jesteś zalogowany");
  return session.user.id;
}

/** `request` is the user's own wish for the plan; without it the review goes by the data. */
export async function proposePlanRevision(request?: string): Promise<{ ok: true } | { error: string }> {
  const userId = await requireUserId();
  const wish = request?.trim() || undefined;
  if (wish && wish.length > MAX_REQUEST_LENGTH) {
    return { error: `Prośba może mieć najwyżej ${MAX_REQUEST_LENGTH} znaków` };
  }
  try {
    const id = await generatePlanRevision(userId, todayISO(), wish);
    if (!id) return { error: "Nie masz planu treningowego" };
  } catch (error) {
    console.error("proposePlanRevision failed:", error);
    return { error: aiErrorMessage(error) };
  }
  updateTag("plan-revisions");
  return { ok: true };
}

type ApplyResult =
  | { ok: true }
  | { error: string }
  // The proposed name is close to one the user has: ask before creating a near-duplicate.
  | { confirm: { proposed: string; similarId: string; similarName: string } };

/** How to resolve a new exercise name after the "Czy chodziło o…?" prompt. */
export type ExerciseChoice = { useExerciseId: string } | { createNew: true };

async function loadChange(userId: string, revisionId: string, index: number) {
  const revision = await db.query.planRevisions.findFirst({
    where: and(eq(planRevisions.id, revisionId), eq(planRevisions.userId, userId)),
  });
  const change = revision?.changes[index];
  if (!revision || !change) throw new Error("Nie znaleziono propozycji");
  return { revision, change };
}

function withStatus(changes: PlanChange[], index: number, status: PlanChange["status"]) {
  return changes.map((c, i) => (i === index ? { ...c, status } : c));
}

export async function applyPlanChange(
  revisionId: string,
  index: number,
  choice?: ExerciseChoice
): Promise<ApplyResult> {
  const userId = await requireUserId();
  const { revision, change } = await loadChange(userId, revisionId, index);
  if (change.status !== "pending") return { error: "Ta zmiana jest już rozpatrzona" };

  const plan = await loadTrainingPlan(userId);
  if (!plan || plan.id !== revision.planId) return { error: "Plan zmienił się od tej propozycji" };
  const current = plan.days.flatMap((d) => d.exercises).find((e) => e.id === change.planExerciseId);
  if (change.type !== "add" && !current) {
    return { error: "Tego ćwiczenia nie ma już w planie — odrzuć tę zmianę" };
  }

  const writes: BatchItem<"sqlite">[] = [];
  let createdExercise = false;

  // A name the user already has is reused; a near-duplicate needs the user's call.
  let exerciseId: string | null = null;
  if (change.type === "replace" || change.type === "add") {
    const name = change.exerciseName!;
    const own = await db.query.exercises.findMany({ where: eq(exercises.userId, userId) });
    const exact = own.find((e) => exerciseKey(e.name) === exerciseKey(name));
    let resolved = exact ?? null;
    if (!resolved && choice && "useExerciseId" in choice) {
      resolved = own.find((e) => e.id === choice.useExerciseId) ?? null;
      if (!resolved) return { error: "Nie znaleziono ćwiczenia" };
    }
    if (resolved) {
      exerciseId = resolved.id;
      const day = plan.days.find((d) =>
        change.type === "add" ? d.label === change.dayLabel : d.exercises.some((e) => e.id === current!.id)
      );
      if (day?.exercises.some((e) => e.exerciseId === resolved.id)) {
        return { error: `„${resolved.name}” już jest w tym dniu planu — odrzuć tę zmianę` };
      }
      // An existing exercise keeps its unit: seconds ↔ reps needs a new range.
      if (
        change.type === "replace" &&
        resolved.unit !== current!.exercise.unit &&
        (change.repMin == null || change.repMax == null)
      ) {
        return { error: "Ta zamiana zmienia sekundy na powtórzenia (lub odwrotnie) bez nowego zakresu — odrzuć ją" };
      }
    } else {
      const similar = choice ? null : findSimilarExercise(name, own);
      if (similar) return { confirm: { proposed: name, similarId: similar.id, similarName: similar.name } };
      exerciseId = uuid();
      createdExercise = true;
      writes.push(db.insert(exercises).values({ id: exerciseId, userId, name, unit: change.unit ?? "reps" }));
    }
  }

  const counts = {
    ...(change.sets != null && { sets: change.sets }),
    ...(change.repMin != null && { repMin: change.repMin }),
    ...(change.repMax != null && { repMax: change.repMax }),
  };
  if (change.type === "update") {
    writes.push(
      db
        .update(planExercises)
        .set({
          ...counts,
          ...(change.tips != null && { tips: change.tips }),
          ...(change.alternative != null && { alternative: change.alternative }),
        })
        .where(eq(planExercises.id, current!.id))
    );
  } else if (change.type === "replace") {
    // Tips and the alternative described the old exercise, so they go with it.
    writes.push(
      db
        .update(planExercises)
        .set({ ...counts, exerciseId: exerciseId!, tips: change.tips, alternative: change.alternative })
        .where(eq(planExercises.id, current!.id))
    );
  } else if (change.type === "add") {
    const day = plan.days.find((d) => d.label === change.dayLabel);
    if (!day) return { error: "Nie ma takiego dnia w planie" };
    writes.push(
      db.insert(planExercises).values({
        id: uuid(),
        planDayId: day.id,
        exerciseId: exerciseId!,
        position: Math.max(0, ...day.exercises.map((e) => e.position)) + 1,
        sets: change.sets!,
        repMin: change.repMin!,
        repMax: change.repMax!,
        tips: change.tips,
        alternative: change.alternative,
      })
    );
  } else {
    writes.push(db.delete(planExercises).where(eq(planExercises.id, current!.id)));
  }

  writes.push(
    db
      .update(planRevisions)
      .set({ changes: withStatus(revision.changes, index, "applied") })
      .where(eq(planRevisions.id, revision.id))
  );
  await db.batch(writes as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);

  updateTag("plan");
  updateTag("plan-revisions");
  if (createdExercise) updateTag("gym");
  return { ok: true };
}

export async function rejectPlanChange(revisionId: string, index: number) {
  const userId = await requireUserId();
  const { revision, change } = await loadChange(userId, revisionId, index);
  if (change.status !== "pending") return;
  await db
    .update(planRevisions)
    .set({ changes: withStatus(revision.changes, index, "rejected") })
    .where(eq(planRevisions.id, revision.id));
  updateTag("plan-revisions");
}
