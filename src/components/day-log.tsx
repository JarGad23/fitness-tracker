"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dumbbell,
  PersonStanding,
  Bike,
  Waves,
  Plus,
  X,
  LucideIcon,
} from "lucide-react";
import {
  cn,
  formatDayNameShort,
  toISODateString,
  isToday,
  getWeekDays,
} from "@/lib/utils";
import { AddActivityModal } from "./add-activity-modal";
import { deleteWorkout } from "@/actions/workouts";
import type { ActivityType, Workout } from "@/lib/db/schema";

const iconMap: Record<string, LucideIcon> = {
  Dumbbell,
  PersonStanding,
  Bike,
  Waves,
};

type DayLogProps = {
  weekDate: Date;
  activityTypes: ActivityType[];
  workouts: (Workout & { activityType: ActivityType })[];
};

export function DayLog({ weekDate, activityTypes, workouts }: DayLogProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const days = getWeekDays(weekDate);

  const getWorkoutsForDay = (date: Date) => {
    const dateStr = toISODateString(date);
    return workouts.filter((w) => w.date === dateStr);
  };

  const handleDelete = async (workoutId: string) => {
    try {
      await deleteWorkout(workoutId);
    } catch (error) {
      console.error("Failed to delete workout:", error);
    }
  };

  return (
    <>
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          Dziennik tygodnia
        </h2>
        <div className="space-y-2">
          {days.map((day) => {
            const dayWorkouts = getWorkoutsForDay(day);
            const dateStr = toISODateString(day);
            const today = isToday(day);

            return (
              <Card
                key={dateStr}
                className={cn(today && "ring-2 ring-primary/30")}
              >
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "w-14 text-center shrink-0 py-1 rounded",
                        today ? "bg-primary text-primary-foreground" : "bg-muted"
                      )}
                    >
                      <div className="text-xs uppercase font-medium">
                        {formatDayNameShort(day)}
                      </div>
                      <div className="text-lg font-bold">
                        {day.getDate()}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      {dayWorkouts.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {dayWorkouts.map((workout) => {
                            const Icon =
                              iconMap[workout.activityType.icon] || Dumbbell;
                            return (
                              <Badge
                                key={workout.id}
                                variant="secondary"
                                className="pl-2 pr-1 py-1 gap-1 group"
                              >
                                <Icon className="w-3 h-3" />
                                <span className="text-xs">
                                  {workout.activityType.name}
                                </span>
                                {workout.notes && (
                                  <span className="text-xs text-muted-foreground ml-1">
                                    ({workout.notes})
                                  </span>
                                )}
                                <button
                                  onClick={() => handleDelete(workout.id)}
                                  className="ml-1 p-0.5 rounded hover:bg-destructive/20 hover:text-destructive transition-colors"
                                  title="Usuń"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </Badge>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Brak aktywności
                        </p>
                      )}
                    </div>

                    <Button
                      size="sm"
                      variant="ghost"
                      className="shrink-0"
                      onClick={() => setSelectedDate(day)}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
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
