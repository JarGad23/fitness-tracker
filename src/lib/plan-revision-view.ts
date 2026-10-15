import type { PlanChange, PlanRevision } from "@/lib/db/schema";
import type { TrainingPlanFull } from "@/lib/queries";
import { formatRepRange } from "@/lib/plan";

// Turns a stored revision into what /plan shows. Titles and the before → after line
// come from the snapshot stored with each change; the current plan only decides
// whether a pending change still applies.

/** Cap on the user's own wish sent with "Zaproponuj zmiany" (shared by the form and the action). */
export const MAX_REQUEST_LENGTH = 1000;

export type PlanChangeView = {
  index: number;
  type: PlanChange["type"];
  status: PlanChange["status"];
  dayLabel: string | null;
  title: string;
  before: string | null;
  after: string | null;
  notes: string[];
  reason: string;
  stale: boolean; // pending, but its target is gone from the plan
};

export type PlanRevisionView = {
  id: string;
  summary: string;
  createdLabel: string;
  model: string;
  changes: PlanChangeView[];
};

const volume = (sets: number, repMin: number, repMax: number, unit: "reps" | "sec") =>
  `${sets} × ${formatRepRange({ repMin, repMax }, unit)}`;

export function planRevisionView(
  revision: PlanRevision,
  plan: TrainingPlanFull,
  createdLabel: string
): PlanRevisionView {
  const planExerciseIds = new Set(plan.days.flatMap((d) => d.exercises.map((e) => e.id)));
  const dayLabels = new Set(plan.days.map((d) => d.label));

  const changes = revision.changes.map((c, index): PlanChangeView => {
    const notes = [
      c.tips && `Wskazówka: ${c.tips}`,
      c.alternative && `Zamiennik: ${c.alternative}`,
    ].filter((n): n is string => !!n);
    const pending = c.status === "pending";
    const base = { index, type: c.type, status: c.status, reason: c.reason, notes };

    if (c.type === "add" || !c.before) {
      return {
        ...base,
        dayLabel: c.dayLabel,
        title: `Dodaj: ${c.exerciseName}`,
        before: null,
        after: volume(c.sets!, c.repMin!, c.repMax!, c.unit ?? "reps"),
        stale: pending && !dayLabels.has(c.dayLabel ?? ""),
      };
    }
    const b = c.before;
    const now = volume(b.sets, b.repMin, b.repMax, b.unit);
    const next = volume(c.sets ?? b.sets, c.repMin ?? b.repMin, c.repMax ?? b.repMax, c.unit ?? b.unit);
    const view = {
      ...base,
      dayLabel: b.dayLabel,
      stale: pending && !planExerciseIds.has(c.planExerciseId ?? ""),
    };
    switch (c.type) {
      case "update":
        return { ...view, title: b.exerciseName, before: now, after: next !== now ? next : null };
      case "replace":
        return {
          ...view,
          title: `${b.exerciseName} → ${c.exerciseName}`,
          before: now,
          after: next !== now ? next : null,
        };
      case "remove":
        return { ...view, title: `Usuń: ${b.exerciseName}`, before: now, after: null };
    }
  });

  return { id: revision.id, summary: revision.summary, createdLabel, model: revision.model, changes };
}
