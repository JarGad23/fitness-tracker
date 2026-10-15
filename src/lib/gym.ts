import type { Exercise, WorkoutSet } from "@/lib/db/schema";

/** Free-text note on one session ("hantle, skos 30°") — read by every AI coach task. */
export const WORKOUT_NOTE_MAX_LENGTH = 1000;

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

export type ExerciseUnit = Exercise["unit"];

// A timed exercise (plank) keeps seconds in `reps`.
export function formatReps(reps: number, unit: ExerciseUnit = "reps") {
  return unit === "sec" ? `${reps} s` : String(reps);
}

export function formatSet(set: Pick<WorkoutSet, "reps" | "weightKg">, unit: ExerciseUnit = "reps") {
  // kg × reps, like the record line; MC = masa ciała (bodyweight)
  const reps = formatReps(set.reps, unit);
  if (unit === "sec" && set.weightKg == null) return reps;
  const weight = set.weightKg == null ? "MC" : set.weightKg.toLocaleString("pl-PL");
  return `${weight}×${reps}`;
}

// --- Exercise name matching (suggestions while typing, typo check before adding) ---

// Case- and accent-insensitive: "Wznoś" = "wznos". "ł" has no decomposition, so it's mapped by hand.
export function searchKey(name: string) {
  return exerciseKey(name)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ł/g, "l");
}

// Words that carry meaning: "na", "z", "do" don't tell exercises apart.
function words(name: string) {
  return searchKey(name)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 3);
}

// Optimal string alignment distance: an adjacent swap ("wzonsy" → "wznosy") counts as one edit.
function editDistance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

function commonPrefix(a: string, b: string) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

// Same word give or take a typo or a Polish ending: "bok"/"bokiem", "hantli"/"hantlami".
function sameWord(a: string, b: string) {
  if (a === b || a.startsWith(b) || b.startsWith(a)) return true;
  if (commonPrefix(a, b) >= 5) return true;
  return Math.min(a.length, b.length) >= 4 && editDistance(a, b) <= (a.length >= 7 ? 2 : 1);
}

/** Suggestions while typing: every typed word starts (or appears in) a word of the name. */
export function matchExercises<T extends { name: string }>(query: string, options: T[], limit = 6) {
  const typed = searchKey(query).split(/\s+/).filter(Boolean);
  if (typed.length === 0) return [];
  return options
    .filter((o) => {
      const name = searchKey(o.name);
      return typed.every((t) => name.includes(t));
    })
    .slice(0, limit);
}

/**
 * An existing exercise that a new name is probably a typo or variant of — every
 * meaningful word on both sides has a counterpart. "Wspięcia na łydki siedząc" is not
 * a variant of "Wspięcia na łydki" (an extra word), so a real new exercise isn't nagged.
 */
export function findSimilarExercise<T extends { name: string }>(name: string, options: T[]) {
  const key = exerciseKey(name);
  if (options.some((o) => exerciseKey(o.name) === key)) return null;
  // "Facepull" vs "Face pull": the same letters, only the spaces differ.
  const glued = searchKey(name).replace(/[^\p{L}\p{N}]/gu, "");
  const sameLetters = options.find(
    (o) => searchKey(o.name).replace(/[^\p{L}\p{N}]/gu, "") === glued
  );
  if (sameLetters) return sameLetters;
  const mine = words(name);
  if (mine.length === 0) return null;
  return (
    options.find((o) => {
      const theirs = words(o.name);
      return (
        theirs.length > 0 &&
        mine.every((w) => theirs.some((t) => sameWord(w, t))) &&
        theirs.every((t) => mine.some((w) => sameWord(w, t)))
      );
    }) ?? null
  );
}
