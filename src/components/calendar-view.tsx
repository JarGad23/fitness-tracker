"use client";

import { useState } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameWeek,
  format,
} from "date-fns";
import { pl } from "date-fns/locale";
import { Plus } from "lucide-react";

import {
  cn,
  toISODateString,
  isToday,
  getWeekDays,
  formatDayNameShort,
} from "@/lib/utils";
import {
  resolveActivityColor,
  activityColorStyles,
} from "@/lib/activity-colors";
import { AddActivityModal } from "./add-activity-modal";
import type { ActivityType, Workout } from "@/lib/db/schema";

type WorkoutWithType = Workout & { activityType: ActivityType };

type CalendarViewProps = {
  weekDate: Date;
  activityTypes: ActivityType[];
  workouts: WorkoutWithType[];
};

export function CalendarView({
  weekDate,
  activityTypes,
  workouts,
}: CalendarViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const byDay = new Map<string, WorkoutWithType[]>();
  for (const workout of workouts) {
    const list = byDay.get(workout.date) ?? [];
    list.push(workout);
    byDay.set(workout.date, list);
  }
  const workoutsFor = (day: Date) => byDay.get(toISODateString(day)) ?? [];

  // Month grid (desktop): full weeks covering the current month.
  const gridStart = startOfWeek(startOfMonth(weekDate), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(weekDate), { weekStartsOn: 1 });
  const monthDays = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const weeks: Date[][] = [];
  for (let i = 0; i < monthDays.length; i += 7) {
    weeks.push(monthDays.slice(i, i + 7));
  }

  // Week strip (mobile).
  const weekDays = getWeekDays(weekDate);

  return (
    <>
      {/* DESKTOP: month calendar */}
      <div className="hidden lg:block space-y-3">
        <h3 className="text-sm font-semibold capitalize">
          {format(weekDate, "LLLL yyyy", { locale: pl })}
        </h3>

        <div className="grid grid-cols-7 gap-2">
          {weeks[0].map((day) => (
            <div
              key={"weekday-" + toISODateString(day)}
              className="text-center text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              {formatDayNameShort(day)}
            </div>
          ))}
        </div>

        <div className="space-y-2">
          {weeks.map((week) => {
            const isCurrentWeek = isSameWeek(week[0], weekDate, {
              weekStartsOn: 1,
            });
            return (
              <div
                key={"week-" + toISODateString(week[0])}
                className={cn(
                  "grid grid-cols-7 gap-2 rounded-xl",
                  isCurrentWeek && "bg-primary/5 p-1.5 ring-1 ring-primary/20"
                )}
              >
                {week.map((day) => {
                  const dayWorkouts = workoutsFor(day);
                  const inMonth = isSameMonth(day, weekDate);
                  const today = isToday(day);

                  return (
                    <button
                      key={toISODateString(day)}
                      type="button"
                      onClick={() => setSelectedDate(day)}
                      className={cn(
                        "group flex min-h-[108px] flex-col gap-1.5 rounded-xl border p-2 text-left transition-colors",
                        today
                          ? "border-primary/60 bg-primary/5"
                          : "border-border/50 bg-card hover:border-border",
                        !inMonth && "opacity-40"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={cn(
                            "text-sm font-semibold tabular-nums",
                            today && "text-primary"
                          )}
                        >
                          {day.getDate()}
                        </span>
                        <Plus className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>

                      <div className="flex flex-col gap-1">
                        {dayWorkouts.slice(0, 3).map((workout) => {
                          const hex = resolveActivityColor(
                            workout.activityType
                          );
                          const styles = activityColorStyles(hex);
                          return (
                            <span
                              key={workout.id}
                              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.7rem] font-medium"
                              style={{ ...styles.soft, ...styles.text }}
                            >
                              <span
                                className="h-1.5 w-1.5 shrink-0 rounded-full"
                                style={styles.solid}
                              />
                              <span className="truncate">
                                {workout.activityType.name}
                              </span>
                            </span>
                          );
                        })}
                        {dayWorkouts.length > 3 && (
                          <span className="px-1 text-[0.7rem] font-medium text-muted-foreground">
                            +{dayWorkouts.length - 3} więcej
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* MOBILE: week strip */}
      <div className="lg:hidden space-y-4">
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day) => (
            <div
              key={"m-weekday-" + toISODateString(day)}
              className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              {formatDayNameShort(day)}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day) => {
            const dayWorkouts = workoutsFor(day);
            const today = isToday(day);
            const hasWorkouts = dayWorkouts.length > 0;

            return (
              <button
                key={toISODateString(day)}
                type="button"
                onClick={() => setSelectedDate(day)}
                className={cn(
                  "flex min-h-[84px] flex-col items-center justify-start rounded-xl p-2 transition-all",
                  today
                    ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground shadow-lg shadow-primary/30"
                    : hasWorkouts
                      ? "border border-border/50 bg-muted/50"
                      : "border border-border/50 bg-background"
                )}
              >
                <span
                  className={cn(
                    "text-lg font-bold tabular-nums",
                    today ? "text-white" : "text-foreground"
                  )}
                >
                  {day.getDate()}
                </span>
                <div className="mt-2 flex flex-wrap justify-center gap-1">
                  {dayWorkouts.slice(0, 4).map((workout) => {
                    const hex = resolveActivityColor(workout.activityType);
                    return (
                      <span
                        key={workout.id}
                        className={cn(
                          "h-2.5 w-2.5 rounded-full",
                          today && "bg-white/90"
                        )}
                        style={today ? undefined : { backgroundColor: hex }}
                        title={workout.activityType.name}
                      />
                    );
                  })}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedDate && (
        <AddActivityModal
          open={!!selectedDate}
          onOpenChange={(open) => !open && setSelectedDate(null)}
          date={selectedDate}
          dateString={toISODateString(selectedDate)}
          activityTypes={activityTypes}
          workouts={workouts}
        />
      )}
    </>
  );
}
