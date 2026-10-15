import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { parseISO, format } from "date-fns";
import { pl } from "date-fns/locale";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import {
  getCachedWorkoutWithSets,
  getCachedExercises,
  getCachedPreviousStrengthSession,
  getCachedTrainingPlan,
  getCachedLastPlanDayId,
  getCachedLastSessionSets,
} from "@/lib/queries";
import { groupSetsByExercise } from "@/lib/gym";
import { nextPlanDay, suggestSets } from "@/lib/plan";
import { capitalizeFirst } from "@/lib/utils";
import { WorkoutSets, type EditorSet, type WorkoutPlan } from "@/components/workout-sets";
import { WorkoutComment } from "@/components/workout-comment";
import { WorkoutNoteEditor } from "@/components/workout-note-editor";

type Params = Promise<{ id: string }>;

// Rendered on the server (UTC on Vercel), so the time zone is explicit.
const commentedFormat = new Intl.DateTimeFormat("pl-PL", {
  timeZone: "Europe/Warsaw",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

async function WorkoutSection({ params }: { params: Params }) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const workout = await getCachedWorkoutWithSets(userId, id);
  if (!workout || workout.activityType.healthKind !== "strength") notFound();

  const [exercises, previous, trainingPlan] = await Promise.all([
    getCachedExercises(userId, workout.id, workout.date),
    workout.sets.length === 0
      ? getCachedPreviousStrengthSession(userId, workout.id, workout.date)
      : null,
    getCachedTrainingPlan(userId),
  ]);

  // A session from an older plan (or none) shows no plan, just its sets.
  const planDay = trainingPlan?.days.find((d) => d.id === workout.planDayId) ?? null;
  const lastSessions = planDay
    ? await getCachedLastSessionSets(
        userId,
        workout.id,
        workout.date,
        planDay.exercises.map((e) => e.exerciseId)
      )
    : {};
  const plan: WorkoutPlan | null =
    trainingPlan && planDay
      ? {
          dayLabel: planDay.label,
          dayName: planDay.name,
          items: planDay.exercises.map((e) => ({
            id: e.id,
            exerciseId: e.exerciseId,
            exerciseName: e.exercise.name,
            unit: e.exercise.unit,
            sets: e.sets,
            repMin: e.repMin,
            repMax: e.repMax,
            superset: e.superset,
            alternative: e.alternative,
            tips: e.tips,
            suggestion: suggestSets(e, lastSessions[e.exerciseId] ?? null, e.exercise.unit),
          })),
          warmup: trainingPlan.checklist.filter((c) => c.section === "warmup"),
          cardio: trainingPlan.checklist.filter((c) => c.section === "cardio"),
          checks: workout.planChecks ?? [],
        }
      : null;
  const dayChoice =
    trainingPlan && !planDay && workout.sets.length === 0
      ? {
          days: trainingPlan.days.map(({ id, label, name }) => ({ id, label, name })),
          nextId: nextPlanDay(trainingPlan.days, await getCachedLastPlanDayId(userId))?.id ?? null,
        }
      : null;

  const date = parseISO(workout.date);
  const sets: EditorSet[] = workout.sets.map((s) => ({
    id: s.id,
    exerciseId: s.exerciseId,
    exerciseName: s.exercise.name,
    position: s.position,
    reps: s.reps,
    weightKg: s.weightKg,
  }));

  return (
    <>
      <div className="flex items-start gap-3">
        <Link
          href={`/?week=${workout.date}`}
          aria-label="Wróć do kalendarza"
          className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center hover:bg-muted"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight">{workout.activityType.name}</h1>
          <p className="text-sm text-muted-foreground">
            {capitalizeFirst(format(date, "EEEE, d MMMM", { locale: pl }))}
          </p>
        </div>
      </div>

      <WorkoutSets
        workoutId={workout.id}
        sets={sets}
        exercises={exercises}
        plan={plan}
        dayChoice={dayChoice}
        previous={
          previous
            ? {
                workoutId: previous.id,
                label: format(parseISO(previous.date), "EEE d MMM", { locale: pl }),
                exerciseNames: groupSetsByExercise(previous.sets).map((g) => g.exercise.name),
              }
            : null
        }
      />

      <WorkoutNoteEditor workoutId={workout.id} note={workout.notes} />

      <WorkoutComment
        workoutId={workout.id}
        comment={workout.aiComment}
        commentedLabel={
          workout.aiCommentAt ? `Wygenerowano ${commentedFormat.format(workout.aiCommentAt)}` : null
        }
        hasSets={workout.sets.length > 0}
      />
    </>
  );
}

function WorkoutSkeleton() {
  return (
    <>
      <div className="h-16 rounded-xl bg-muted/30 animate-pulse" />
      {[0, 1].map((i) => (
        <div key={i} className="h-44 rounded-xl bg-muted/30 animate-pulse" />
      ))}
    </>
  );
}

export default function WorkoutPage({ params }: { params: Params }) {
  return (
    <div className="p-4 lg:p-0 lg:max-w-4xl space-y-4">
      <Suspense fallback={<WorkoutSkeleton />}>
        <WorkoutSection params={params} />
      </Suspense>
    </div>
  );
}
