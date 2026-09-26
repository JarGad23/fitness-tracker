import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { parseISO, format } from "date-fns";
import { pl } from "date-fns/locale";
import { ArrowLeft, Watch } from "lucide-react";
import { auth } from "@/lib/auth";
import {
  getCachedWorkoutWithSets,
  getCachedExercises,
  getCachedPreviousStrengthSession,
} from "@/lib/queries";
import { groupSetsByExercise } from "@/lib/gym";
import { capitalizeFirst } from "@/lib/utils";
import { WorkoutSets, type EditorSet } from "@/components/workout-sets";

type Params = Promise<{ id: string }>;

async function WorkoutSection({ params }: { params: Params }) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const workout = await getCachedWorkoutWithSets(userId, id);
  if (!workout || workout.activityType.healthKind !== "strength") notFound();

  const [exercises, previous] = await Promise.all([
    getCachedExercises(userId),
    workout.sets.length === 0
      ? getCachedPreviousStrengthSession(userId, workout.id, workout.date)
      : null,
  ]);

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
          {workout.notes && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              {workout.source === "watch" && <Watch className="w-4 h-4 shrink-0" />}
              {workout.notes}
            </p>
          )}
        </div>
      </div>

      <WorkoutSets
        workoutId={workout.id}
        sets={sets}
        exerciseNames={exercises.map((e) => e.name)}
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
    <div className="p-4 lg:p-0 lg:max-w-xl space-y-4">
      <Suspense fallback={<WorkoutSkeleton />}>
        <WorkoutSection params={params} />
      </Suspense>
    </div>
  );
}
