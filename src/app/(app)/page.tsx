import { WeeklyProgress } from "@/components/weekly-progress";
import { CalendarGrid } from "@/components/calendar-grid";
import { WeekNavigation } from "@/components/week-navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, TrendingUp, Target } from "lucide-react";
import { getWeekRange, toISODateString } from "@/lib/utils";
import { getCachedActivityTypes, getCachedWeekWorkouts } from "@/lib/queries";
import { startOfWeek } from "date-fns";

type SearchParams = Promise<{ week?: string }>;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { week } = await searchParams;
  const weekDate = week ? new Date(week) : new Date();
  const normalizedWeekDate = startOfWeek(weekDate, { weekStartsOn: 1 });

  const { start, end } = getWeekRange(normalizedWeekDate);
  const startDate = toISODateString(start);
  const endDate = toISODateString(end);

  const [activityTypes, workouts] = await Promise.all([
    getCachedActivityTypes(),
    getCachedWeekWorkouts(startDate, endDate),
  ]);

  const totalTarget = activityTypes.reduce((sum, a) => sum + a.targetPerWeek, 0);
  const totalCompleted = workouts.length;
  const completionPercent =
    totalTarget > 0 ? Math.round((totalCompleted / totalTarget) * 100) : 0;

  return (
    <div className="p-4 lg:p-0 space-y-6">
      {/* Stats Cards - Desktop */}
      <div className="hidden lg:grid lg:grid-cols-3 gap-4">
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
                <p className="text-sm text-muted-foreground font-medium">
                  Postęp
                </p>
                <p className="text-2xl font-bold">{completionPercent}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="lg:grid lg:grid-cols-5 lg:gap-6">
        {/* Calendar Section */}
        <div className="lg:col-span-3 space-y-4">
          <WeekNavigation weekDate={normalizedWeekDate} />

          <Card className="border-border/50 overflow-hidden">
            <CardHeader className="pb-2 border-b border-border/50 bg-muted/30">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-muted-foreground" />
                Kalendarz tygodnia
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 lg:p-6">
              <CalendarGrid
                weekDate={normalizedWeekDate}
                activityTypes={activityTypes}
                workouts={workouts}
              />
            </CardContent>
          </Card>
        </div>

        {/* Progress Section */}
        <div className="lg:col-span-2 mt-6 lg:mt-0">
          <Card className="border-border/50 overflow-hidden h-fit">
            <CardHeader className="pb-2 border-b border-border/50 bg-muted/30">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-muted-foreground" />
                Postęp tygodnia
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 lg:p-6">
              <WeeklyProgress activityTypes={activityTypes} workouts={workouts} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
