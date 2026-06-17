import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { workouts, activityTypes } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Trophy, TrendingUp } from "lucide-react";
import { getWeekNumber, getWeekYear } from "@/lib/utils";
import { startOfWeek, format } from "date-fns";
import { pl } from "date-fns/locale";

async function getWeeklyHistory() {
  "use cache: private";
  cacheTag("workouts", "activity-types");
  cacheLife("minutes");

  const session = await auth();
  if (!session?.user?.id) return [];

  const userWorkouts = await db.query.workouts.findMany({
    where: eq(workouts.userId, session.user.id),
    with: {
      activityType: true,
    },
    orderBy: [desc(workouts.date)],
  });

  const userActivityTypes = await db.query.activityTypes.findMany({
    where: eq(activityTypes.userId, session.user.id),
  });

  const totalTarget = userActivityTypes.reduce(
    (sum, a) => sum + a.targetPerWeek,
    0
  );

  const weekMap = new Map<
    string,
    {
      weekStart: Date;
      weekNum: number;
      year: number;
      workouts: typeof userWorkouts;
      completed: number;
      target: number;
    }
  >();

  userWorkouts.forEach((workout) => {
    const date = new Date(workout.date);
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    const key = format(weekStart, "yyyy-MM-dd");

    if (!weekMap.has(key)) {
      weekMap.set(key, {
        weekStart,
        weekNum: getWeekNumber(date),
        year: getWeekYear(date),
        workouts: [],
        completed: 0,
        target: totalTarget,
      });
    }

    const week = weekMap.get(key)!;
    week.workouts.push(workout);
    week.completed++;
  });

  return Array.from(weekMap.values()).sort(
    (a, b) => b.weekStart.getTime() - a.weekStart.getTime()
  );
}

export default async function HistoriaPage() {
  const history = await getWeeklyHistory();

  return (
    <div className="p-4 lg:p-0 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Historia</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Przegląd Twoich poprzednich tygodni
          </p>
        </div>
        <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="w-4 h-4" />
          {history.length} tygodni
        </div>
      </div>

      {history.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <CalendarDays className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Brak historii</h3>
            <p className="text-muted-foreground">
              Zacznij dodawać aktywności, a tutaj zobaczysz swoją historię!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {history.map((week) => {
            const percentage = Math.round(
              (week.completed / week.target) * 100
            );
            const isComplete = percentage >= 100;
            const dateRange = `${format(week.weekStart, "d MMM", { locale: pl })} - ${format(
              new Date(week.weekStart.getTime() + 6 * 24 * 60 * 60 * 1000),
              "d MMM yyyy",
              { locale: pl }
            )}`;

            return (
              <Card
                key={week.weekStart.toISOString()}
                className={`border-border/50 overflow-hidden transition-all hover:border-border ${isComplete ? 'ring-1 ring-primary/20' : ''}`}
              >
                <CardHeader className="pb-3 bg-muted/30 border-b border-border/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isComplete ? 'bg-primary/10' : 'bg-muted'}`}>
                        {isComplete ? (
                          <Trophy className="w-5 h-5 text-primary" />
                        ) : (
                          <CalendarDays className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-base font-semibold">
                          Tydzień {week.weekNum}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">{dateRange}</p>
                      </div>
                    </div>
                    <Badge
                      variant={isComplete ? "default" : "secondary"}
                      className="text-sm font-semibold"
                    >
                      {percentage}%
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${isComplete ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {week.completed} / {week.target} aktywności
                      </span>
                      {isComplete && (
                        <span className="text-primary font-medium flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          Cel osiągnięty!
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
