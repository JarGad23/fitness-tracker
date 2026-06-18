import { Suspense } from "react";
import { WeeklyProgress } from "@/components/weekly-progress";
import { CalendarView } from "@/components/calendar-view";
import { WeekNavigation } from "@/components/week-navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, TrendingUp, Target } from "lucide-react";
import { getWeekRange, toISODateString } from "@/lib/utils";
import {
  getCachedActivityTypes,
  getCachedWorkoutsInRange,
} from "@/lib/queries";
import { auth } from "@/lib/auth";
import { startOfWeek, startOfMonth, endOfMonth, endOfWeek } from "date-fns";

type SearchParams = Promise<{ week?: string }>;

// Per-request context. auth() and the cached queries are deduplicated within a
// request, so calling this from each section does not cause duplicate DB hits.
async function getContext(searchParams: SearchParams) {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const { week } = await searchParams;
  const weekDate = week ? new Date(week) : new Date();
  const normalizedWeekDate = startOfWeek(weekDate, { weekStartsOn: 1 });

  const { start, end } = getWeekRange(normalizedWeekDate);
  const monthGridStart = startOfWeek(startOfMonth(normalizedWeekDate), {
    weekStartsOn: 1,
  });
  const monthGridEnd = endOfWeek(endOfMonth(normalizedWeekDate), {
    weekStartsOn: 1,
  });

  return {
    userId,
    normalizedWeekDate,
    weekStartDate: toISODateString(start),
    weekEndDate: toISODateString(end),
    monthGridStart: toISODateString(monthGridStart),
    monthGridEnd: toISODateString(monthGridEnd),
  };
}

async function getRangeData(userId: string, startDate: string, endDate: string) {
  return Promise.all([
    getCachedActivityTypes(userId),
    getCachedWorkoutsInRange(userId, startDate, endDate),
  ]);
}

// --- Dynamic sections: each streams into its own Suspense hole ---

async function StatsCards({ searchParams }: { searchParams: SearchParams }) {
  const { userId, weekStartDate, weekEndDate } = await getContext(searchParams);
  if (!userId) return null;
  const [activityTypes, workouts] = await getRangeData(
    userId,
    weekStartDate,
    weekEndDate
  );

  const totalTarget = activityTypes.reduce((sum, a) => sum + a.targetPerWeek, 0);
  const totalCompleted = workouts.length;
  const completionPercent =
    totalTarget > 0 ? Math.round((totalCompleted / totalTarget) * 100) : 0;

  return (
    <>
      <Card className="border-border/50">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Target className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">
                Cel tygodnia
              </p>
              <p className="text-2xl font-bold">{totalTarget} treningów</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">
                Ukończono
              </p>
              <p className="text-2xl font-bold">
                {totalCompleted} / {totalTarget}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
              <CalendarDays className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">Postęp</p>
              <p className="text-2xl font-bold">{completionPercent}%</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

async function WeekNav({ searchParams }: { searchParams: SearchParams }) {
  const { normalizedWeekDate } = await getContext(searchParams);
  return <WeekNavigation weekDate={normalizedWeekDate} />;
}

async function CalendarSection({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { userId, normalizedWeekDate, monthGridStart, monthGridEnd } =
    await getContext(searchParams);
  if (!userId) return null;
  const [activityTypes, workouts] = await getRangeData(
    userId,
    monthGridStart,
    monthGridEnd
  );
  return (
    <CalendarView
      weekDate={normalizedWeekDate}
      activityTypes={activityTypes}
      workouts={workouts}
    />
  );
}

async function ProgressSection({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { userId, weekStartDate, weekEndDate } = await getContext(searchParams);
  if (!userId) return null;
  const [activityTypes, workouts] = await getRangeData(
    userId,
    weekStartDate,
    weekEndDate
  );
  return (
    <WeeklyProgress
      activityTypes={activityTypes}
      workouts={workouts}
      weekKey={weekStartDate}
    />
  );
}

// --- Skeletons (sized to match the real content) ---

function StatsSkeleton() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <Card key={i} className="border-border/50 animate-pulse">
          <CardContent className="h-[88px]" />
        </Card>
      ))}
    </>
  );
}

function WeekNavSkeleton() {
  return (
    <Card className="h-[60px] lg:h-[68px] border-border/50 animate-pulse" />
  );
}

function CalendarSkeleton() {
  return <div className="h-96 rounded-xl bg-muted/30 animate-pulse" />;
}

function ProgressSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-16 rounded-xl bg-muted/30 animate-pulse" />
      ))}
    </div>
  );
}

// --- Page: static shell prerendered, each section streams independently ---

export default function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <div className="p-4 lg:p-0 space-y-6">
      {/* Stats Cards - Desktop */}
      <div className="hidden lg:grid lg:grid-cols-3 gap-4">
        <Suspense fallback={<StatsSkeleton />}>
          <StatsCards searchParams={searchParams} />
        </Suspense>
      </div>

      {/* Main Content Grid */}
      <div className="lg:grid lg:grid-cols-3 lg:gap-6">
        {/* Calendar Section */}
        <div className="lg:col-span-2 space-y-4">
          <Suspense fallback={<WeekNavSkeleton />}>
            <WeekNav searchParams={searchParams} />
          </Suspense>

          <Card className="border-border/50 overflow-hidden">
            <CardHeader className="pb-2 border-b border-border/50 bg-muted/30">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-muted-foreground" />
                Kalendarz
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 lg:p-6">
              <Suspense fallback={<CalendarSkeleton />}>
                <CalendarSection searchParams={searchParams} />
              </Suspense>
            </CardContent>
          </Card>
        </div>

        {/* Progress Section */}
        <div className="lg:col-span-1 mt-6 lg:mt-0">
          <Card className="border-border/50 overflow-hidden h-fit">
            <CardHeader className="pb-2 border-b border-border/50 bg-muted/30">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-muted-foreground" />
                Postęp tygodnia
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 lg:p-6">
              <Suspense fallback={<ProgressSkeleton />}>
                <ProgressSection searchParams={searchParams} />
              </Suspense>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
