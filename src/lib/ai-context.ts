// Pure builder for GET /api/ai/context: the data contract the local AI coach reads.
// Weekly aggregates are computed here rather than left to the model — small local
// models are unreliable at arithmetic, so they get ready numbers next to the raw rows.

import { parseISO, subWeeks } from "date-fns";
import type { ActivityType, CoachReport, HealthMetric, Workout } from "@/lib/db/schema";
import { avg } from "@/lib/ai-sync";
import { groupSetsByExercise, type SetWithExercise } from "@/lib/gym";
import { getWeekRange, toISODateString } from "@/lib/utils";

export const AI_CONTEXT_VERSION = 1;
export const MAX_CONTEXT_WEEKS = 12;

export type WorkoutWithSets = Workout & {
  activityType: ActivityType;
  sets: SetWithExercise[];
};

const round = (value: number | null, digits = 0) =>
  value == null ? null : Number(value.toFixed(digits));

const present = <T,>(values: (T | null)[]) => values.filter((v): v is T => v != null);

/** Monday–Sunday ranges, oldest first, ending with the week that contains `today`. */
export function contextWeekRanges(today: string, weeks: number) {
  const now = parseISO(today);
  return Array.from({ length: weeks }, (_, i) => {
    const { start, end } = getWeekRange(subWeeks(now, weeks - 1 - i));
    return { start: toISODateString(start), end: toISODateString(end) };
  });
}

export function buildAIContext(input: {
  today: string;
  weeks: number;
  activityTypes: ActivityType[];
  workouts: WorkoutWithSets[];
  healthMetrics: HealthMetric[];
  latestReport: CoachReport | null;
}) {
  const { today, activityTypes, workouts, healthMetrics, latestReport } = input;
  const ranges = contextWeekRanges(today, input.weeks);

  const weeks = ranges.map(({ start, end }, i) => {
    const weekWorkouts = workouts.filter((w) => w.date >= start && w.date <= end);
    const weekHealth = healthMetrics.filter((h) => h.date >= start && h.date <= end);
    const exerciseMinutes = present(weekHealth.map((h) => h.exerciseMinutes));

    return {
      start,
      end,
      current: i === ranges.length - 1,
      activities: activityTypes.map((type) => {
        const done = weekWorkouts.filter((w) => w.activityTypeId === type.id);
        return {
          name: type.name,
          done: done.length,
          target: type.targetPerWeek,
          feeling_avg: round(avg(present(done.map((w) => w.feelingScore))), 1),
        };
      }),
      health: {
        days_with_data: weekHealth.length,
        avg_active_calories: round(avg(present(weekHealth.map((h) => h.activeCalories)))),
        avg_resting_hr: round(avg(present(weekHealth.map((h) => h.restingHr)))),
        avg_sleep_hours: round(avg(present(weekHealth.map((h) => h.sleepHours))), 1),
        exercise_minutes_total:
          exerciseMinutes.length > 0 ? exerciseMinutes.reduce((a, b) => a + b, 0) : null,
      },
    };
  });

  return {
    version: AI_CONTEXT_VERSION,
    generated_at: new Date().toISOString(),
    today,
    week_starts_on: "monday",
    period: { start: ranges[0].start, end: ranges[ranges.length - 1].end },
    activities: activityTypes.map((t) => ({
      name: t.name,
      target_per_week: t.targetPerWeek,
      health_kind: t.healthKind,
    })),
    weeks,
    workouts: workouts.map((w) => ({
      date: w.date,
      activity: w.activityType.name,
      source: w.source,
      duration: w.duration,
      feeling_score: w.feelingScore,
      notes: w.notes,
      exercises:
        w.sets.length > 0
          ? groupSetsByExercise(w.sets).map((g) => ({
              name: g.exercise.name,
              sets: g.sets.map((s) => ({ reps: s.reps, weight_kg: s.weightKg })),
            }))
          : null,
    })),
    health_days: healthMetrics.map((h) => ({
      date: h.date,
      active_calories: h.activeCalories,
      resting_hr: h.restingHr,
      sleep_hours: h.sleepHours,
      exercise_minutes: h.exerciseMinutes,
      cycling_km: h.cyclingKm,
      swimming_m: h.swimmingM,
      running_speed_kmh: h.runningSpeedKmh,
    })),
    latest_report: latestReport
      ? {
          id: latestReport.id,
          created_at: latestReport.createdAt.toISOString(),
          model: latestReport.model,
          applied: latestReport.appliedAt != null,
        }
      : null,
  };
}
