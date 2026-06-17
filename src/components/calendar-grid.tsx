"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  cn,
  formatDayNameShort,
  toISODateString,
  isToday,
  getWeekDays,
} from "@/lib/utils";
import { getActivityColor } from "@/lib/activity-colors";
import { AddActivityModal } from "./add-activity-modal";
import type { ActivityType, Workout } from "@/lib/db/schema";

type CalendarGridProps = {
  weekDate: Date;
  activityTypes: ActivityType[];
  workouts: (Workout & { activityType: ActivityType })[];
};

export function CalendarGrid({ weekDate, activityTypes, workouts }: CalendarGridProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const days = getWeekDays(weekDate);

  const getWorkoutsForDay = (date: Date) => {
    const dateStr = toISODateString(date);
    return workouts.filter((w) => w.date === dateStr);
  };

  return (
    <>
      <div className="space-y-4">
        {/* Day names header */}
        <div className="grid grid-cols-7 gap-2 lg:gap-3">
          {days.map((day) => (
            <div
              key={toISODateString(day) + "-header"}
              className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider"
            >
              {formatDayNameShort(day)}
            </div>
          ))}
        </div>

        {/* Calendar cells */}
        <div className="grid grid-cols-7 gap-2 lg:gap-3">
          {days.map((day) => {
            const dayWorkouts = getWorkoutsForDay(day);
            const dateStr = toISODateString(day);
            const today = isToday(day);
            const hasWorkouts = dayWorkouts.length > 0;

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(day)}
                className={cn(
                  "group relative flex flex-col items-center justify-start p-2 lg:p-3 rounded-xl min-h-[90px] lg:min-h-[100px] transition-all duration-200",
                  today
                    ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground shadow-lg shadow-primary/30"
                    : hasWorkouts
                      ? "bg-muted/50 hover:bg-muted border border-border/50 hover:border-border"
                      : "bg-background hover:bg-muted/50 border border-border/50 hover:border-primary/30"
                )}
              >
                <span
                  className={cn(
                    "text-lg lg:text-xl font-bold tabular-nums",
                    today ? "text-white" : "text-foreground"
                  )}
                >
                  {day.getDate()}
                </span>

                {/* Activity dots */}
                <div className="flex flex-wrap justify-center gap-1 mt-2">
                  {dayWorkouts.slice(0, 4).map((workout) => {
                    const colors = getActivityColor(workout.activityType.name);
                    return (
                      <div
                        key={workout.id}
                        className={cn(
                          "w-2.5 h-2.5 lg:w-3 lg:h-3 rounded-full transition-transform group-hover:scale-110",
                          today ? "bg-white/90" : colors.dot
                        )}
                        title={workout.activityType.name}
                      />
                    );
                  })}
                </div>

                {dayWorkouts.length > 4 && (
                  <span
                    className={cn(
                      "text-[10px] font-semibold mt-1",
                      today ? "text-white/80" : "text-muted-foreground"
                    )}
                  >
                    +{dayWorkouts.length - 4}
                  </span>
                )}

                {/* Add indicator on hover for empty/few days */}
                {dayWorkouts.length < 4 && !today && (
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Plus className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
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
        />
      )}
    </>
  );
}
