import { WEIGHT_STEP_KG, formatReps, type ExerciseUnit } from "@/lib/gym";

export type PlannedSet = { reps: number; weightKg: number | null };

export type PlanTarget = { sets: number; repMin: number; repMax: number };

export type Suggestion = {
  sets: PlannedSet[]; // one per planned set
  hint: string | null;
};

/** The day after the last one done, wrapping around; the first day if none was done. */
export function nextPlanDay<T extends { id: string }>(days: T[], lastPlanDayId: string | null) {
  const index = days.findIndex((d) => d.id === lastPlanDayId);
  return days[(index + 1) % days.length] ?? null;
}

export function formatRepRange(target: Pick<PlanTarget, "repMin" | "repMax">, unit: ExerciseUnit) {
  const range =
    target.repMin === target.repMax ? `${target.repMin}` : `${target.repMin}–${target.repMax}`;
  return unit === "sec" ? `${range} s` : range;
}

/**
 * Double progression: keep the weight and add reps until every working set reaches
 * the top of the range, then add 2.5 kg and start again from the bottom. Working
 * sets = the last session's sets at its heaviest weight (warm-up ramps don't count).
 */
export function suggestSets(
  target: PlanTarget,
  last: PlannedSet[] | null,
  unit: ExerciseUnit
): Suggestion {
  const repeat = (set: PlannedSet) => Array.from({ length: target.sets }, () => ({ ...set }));
  if (!last || last.length === 0) {
    return {
      sets: repeat({ reps: target.repMin, weightKg: null }),
      hint: unit === "sec" ? null : "Pierwszy raz: wpisz ciężar (puste = masa ciała)",
    };
  }

  const weights = last.map((s) => s.weightKg).filter((w): w is number => w != null);
  const top = weights.length > 0 ? Math.max(...weights) : null;
  const working = last.filter((s) => s.weightKg === top);
  const reachedTop =
    working.length >= target.sets && working.every((s) => s.reps >= target.repMax);
  const topReps = formatReps(target.repMax, unit);

  if (reachedTop && top != null) {
    return {
      sets: repeat({ reps: target.repMin, weightKg: top + WEIGHT_STEP_KG }),
      hint: `Ostatnio wszystkie serie po ${topReps} → +${WEIGHT_STEP_KG.toLocaleString("pl-PL")} kg`,
    };
  }
  if (reachedTop) {
    // Bodyweight: no plate to add, so the range top becomes the target.
    return {
      sets: repeat({ reps: target.repMax, weightKg: null }),
      hint: `Ostatnio wszystkie serie po ${topReps} → możesz dołożyć obciążenie`,
    };
  }

  // Same weight, last session's reps per set: beat them by one where you can.
  const fallback = working.at(-1)?.reps ?? target.repMin;
  return {
    sets: Array.from({ length: target.sets }, (_, i) => ({
      reps: Math.min(Math.max(working[i]?.reps ?? fallback, target.repMin), target.repMax),
      weightKg: top,
    })),
    hint: `Dobijaj do ${topReps} w każdej serii`,
  };
}
