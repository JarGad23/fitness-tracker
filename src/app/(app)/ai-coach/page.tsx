import { Suspense } from "react";
import { auth } from "@/lib/auth";
import {
  getCachedActivityTypes,
  getCachedWorkoutsInRange,
  getCachedHealthMetricsInRange,
  getCachedLatestCoachReport,
  getCachedDayNotesInRange,
} from "@/lib/queries";
import { buildCoachMarkdown, type WorkoutRow } from "@/lib/ai-sync";
import { getWeekRange, getPreviousWeek, toISODateString } from "@/lib/utils";
import { AiCoachContent } from "@/components/ai-coach-content";
import { CoachReport, type CoachReportView } from "@/components/coach-report";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

async function AiCoachData() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const now = new Date();
  const start = toISODateString(getWeekRange(getPreviousWeek(now)).start);
  const end = toISODateString(getWeekRange(now).end);

  const [activityTypes, workouts, healthMetrics, dayNotes] = await Promise.all([
    getCachedActivityTypes(userId),
    getCachedWorkoutsInRange(userId, start, end),
    getCachedHealthMetricsInRange(userId, start, end),
    getCachedDayNotesInRange(userId, start, end),
  ]);

  const markdown = buildCoachMarkdown(
    activityTypes,
    workouts as WorkoutRow[],
    healthMetrics,
    dayNotes,
    now
  );

  return <AiCoachContent markdown={markdown} />;
}

// Rendered on the server (UTC on Vercel), so the time zone is explicit.
const createdFormat = new Intl.DateTimeFormat("pl-PL", {
  timeZone: "Europe/Warsaw",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

async function CoachReportData() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const [report, activityTypes] = await Promise.all([
    getCachedLatestCoachReport(userId),
    getCachedActivityTypes(userId),
  ]);

  let view: CoachReportView | null = null;
  if (report) {
    const current = new Map(
      activityTypes.map((t) => [t.name.trim().toLowerCase(), t.targetPerWeek])
    );
    view = {
      id: report.id,
      body: report.body,
      model: report.model,
      createdLabel: createdFormat.format(report.createdAt),
      periodLabel:
        report.periodStart && report.periodEnd
          ? `${report.periodStart} – ${report.periodEnd}`
          : null,
      applied: report.appliedAt != null,
      targets: (report.targets ?? []).map((t) => ({
        name: t.name,
        current: current.get(t.name.toLowerCase()) ?? null,
        proposed: t.targetPerWeek,
      })),
    };
  }

  return <CoachReport report={view} />;
}

function AiCoachSkeleton({ cards = 2 }: { cards?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: cards }, (_, i) => (
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
          Raporty lokalnego trenera oraz eksport tygodnia do zewnętrznego AI
        </p>
      </div>
      <Suspense fallback={<AiCoachSkeleton cards={1} />}>
        <CoachReportData />
      </Suspense>
      <Suspense fallback={<AiCoachSkeleton />}>
        <AiCoachData />
      </Suspense>
    </div>
  );
}
