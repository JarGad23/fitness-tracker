import type { Exercise, WorkoutSet } from "@/lib/db/schema";

// A day with at least this many Apple Watch exercise minutes and no workout gets a
// "was this the gym?" prompt. Short gym sessions happen, so it sits at 30 even
// though some ~30 min days are just brisk walking — a false hit costs one tap.
export const GYM_PROMPT_MIN_MINUTES = 30;

export const WEIGHT_STEP_KG = 2.5;
export const DEFAULT_REPS = 10;

export type SetWithExercise = WorkoutSet & { exercise: Exercise };

export type ExerciseGroup = {
  exercise: Exercise;
  sets: WorkoutSet[];
};

// Exercise order within a workout = the position of its first set.
export function groupSetsByExercise(sets: SetWithExercise[]): ExerciseGroup[] {
  const groups = new Map<string, ExerciseGroup>();
  for (const set of [...sets].sort((a, b) => a.position - b.position)) {
    const group = groups.get(set.exerciseId);
    if (group) group.sets.push(set);
    else groups.set(set.exerciseId, { exercise: set.exercise, sets: [set] });
  }
  return [...groups.values()];
}

// SQLite lower() only folds ASCII, so "Łydki" vs "łydki" is matched here.
export function exerciseKey(name: string) {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("pl");
}

export function formatWeight(kg: number | null) {
  if (kg == null) return "masa ciała";
  return `${kg.toLocaleString("pl-PL")} kg`;
}

export function formatSet(set: Pick<WorkoutSet, "reps" | "weightKg">) {
  // kg × reps, like the record line; MC = masa ciała (bodyweight)
  const weight = set.weightKg == null ? "MC" : set.weightKg.toLocaleString("pl-PL");
  return `${weight}×${set.reps}`;
}
