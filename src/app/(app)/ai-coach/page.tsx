import { Suspense } from "react";
import { auth } from "@/lib/auth";
import {
  getCachedActivityTypes,
  getCachedWorkoutsInRange,
  getCachedHealthMetricsInRange,
} from "@/lib/queries";
import { buildCoachMarkdown, type WorkoutRow } from "@/lib/ai-sync";
import { getWeekRange, getPreviousWeek, toISODateString } from "@/lib/utils";
import { AiCoachContent } from "@/components/ai-coach-content";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

async function AiCoachData() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const now = new Date();
  const start = toISODateString(getWeekRange(getPreviousWeek(now)).start);
  const end = toISODateString(getWeekRange(now).end);

  const [activityTypes, workouts, healthMetrics] = await Promise.all([
    getCachedActivityTypes(userId),
    getCachedWorkoutsInRange(userId, start, end),
    getCachedHealthMetricsInRange(userId, start, end),
  ]);

  const markdown = buildCoachMarkdown(
    activityTypes,
    workouts as WorkoutRow[],
    healthMetrics,
    now
  );

  return <AiCoachContent markdown={markdown} />;
}

function AiCoachSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1].map((i) => (
        <Card key={i} className="border-border/50 animate-pulse">
          <CardHeader className="h-12 bg-muted/30" />
          <CardContent className="h-40" />
        </Card>
      ))}
    </div>
  );
}

export default function AiCoachPage() {
  return (
    <div className="p-4 lg:p-0 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI Coach Sync</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Wyeksportuj tydzień do trenera AI i zaimportuj jego cele z powrotem
        </p>
      </div>
      <Suspense fallback={<AiCoachSkeleton />}>
        <AiCoachData />
      </Suspense>
    </div>
  );
}
