import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { parseISO, format } from "date-fns";
import { pl } from "date-fns/locale";
import { Trophy } from "lucide-react";
import { auth } from "@/lib/auth";
import { getCachedExerciseHistory } from "@/lib/queries";
import { formatSet, formatWeight } from "@/lib/gym";
import { capitalizeFirst } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

type Params = Promise<{ id: string }>;

type HistorySet = { reps: number; weightKg: number | null };

// Heaviest set; more reps breaks a tie. Bodyweight-only sets rank by reps.
function bestSet(sets: HistorySet[]) {
  return sets.reduce((best, s) =>
    (s.weightKg ?? -1) > (best.weightKg ?? -1) ||
    ((s.weightKg ?? -1) === (best.weightKg ?? -1) && s.reps > best.reps)
      ? s
      : best
  );
}

function workoutsLabel(n: number) {
  if (n === 1) return "trening";
  const tens = n % 100;
  return n % 10 >= 2 && n % 10 <= 4 && (tens < 12 || tens > 14) ? "treningi" : "treningów";
}

async function HistorySection({ params }: { params: Params }) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const history = await getCachedExerciseHistory(userId, id);
  if (!history) notFound();
  const { exercise, sessions } = history;
  const record = sessions.length > 0 ? bestSet(sessions.flatMap((s) => s.sets)) : null;

  return (
    <>
      <div>
        <h1 className="text-xl font-bold tracking-tight">{exercise.name}</h1>
        <p className="text-sm text-muted-foreground">
          {sessions.length === 0
            ? "Jeszcze bez serii"
            : `${sessions.length} ${workoutsLabel(sessions.length)}`}
        </p>
      </div>

      {record && (
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Najlepsza seria</p>
              <p className="text-lg font-bold">
                {formatWeight(record.weightKg)} × {record.reps}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {sessions.length > 0 && (
        <Card className="border-border/50 overflow-hidden">
          <ul className="divide-y divide-border/50">
            {sessions.map((s) => {
              const best = bestSet(s.sets);
              return (
                <li key={s.workoutId}>
                  <Link
                    href={`/trening/${s.workoutId}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50"
                  >
                    <span className="w-20 shrink-0 text-sm font-medium">
                      {capitalizeFirst(format(parseISO(s.date), "EEE d MMM", { locale: pl }))}
                    </span>
                    <span className="flex-1 min-w-0 text-sm text-muted-foreground tabular-nums truncate">
                      {s.sets.map(formatSet).join(", ")}
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {best.weightKg == null ? `${best.reps} powt.` : formatWeight(best.weightKg)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}

function HistorySkeleton() {
  return (
    <>
      <div className="h-12 rounded-xl bg-muted/30 animate-pulse" />
      <div className="h-20 rounded-xl bg-muted/30 animate-pulse" />
      <div className="h-64 rounded-xl bg-muted/30 animate-pulse" />
    </>
  );
}

export default function ExercisePage({ params }: { params: Params }) {
  return (
    <div className="p-4 lg:p-0 lg:max-w-xl space-y-4">
      <Suspense fallback={<HistorySkeleton />}>
        <HistorySection params={params} />
      </Suspense>
    </div>
  );
}
