"use client";

import { Dumbbell, PersonStanding, Bike, Waves, LucideIcon, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { getActivityColor } from "@/lib/activity-colors";
import type { ActivityType, Workout } from "@/lib/db/schema";

const iconMap: Record<string, LucideIcon> = {
  Dumbbell,
  PersonStanding,
  Bike,
  Waves,
};

type WeeklyProgressProps = {
  activityTypes: ActivityType[];
  workouts: (Workout & { activityType: ActivityType })[];
};

export function WeeklyProgress({ activityTypes, workouts }: WeeklyProgressProps) {
  const getCount = (activityTypeId: string) => {
    return workouts.filter((w) => w.activityTypeId === activityTypeId).length;
  };

  return (
    <div className="space-y-3">
      {activityTypes.map((activity) => {
        const count = getCount(activity.id);
        const target = activity.targetPerWeek;
        const percentage = Math.min((count / target) * 100, 100);
        const isComplete = count >= target;
        const Icon = iconMap[activity.icon] || Dumbbell;
        const colors = getActivityColor(activity.name);

        return (
          <div
            key={activity.id}
            className={cn(
              "rounded-xl p-4 transition-all border",
              isComplete
                ? "bg-primary/5 border-primary/30"
                : "bg-muted/30 border-border/50 hover:border-border"
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all",
                  isComplete ? colors.fill : colors.bg
                )}
              >
                {isComplete ? (
                  <Check className="w-5 h-5 text-white" />
                ) : (
                  <Icon className={cn("w-5 h-5", colors.text)} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-foreground text-sm">
                    {activity.name}
                  </span>
                  <span className={cn("font-bold text-sm tabular-nums", isComplete ? "text-primary" : colors.text)}>
                    {count}/{target}
                  </span>
                </div>
                <div className="h-2 bg-background rounded-full overflow-hidden border border-border/30">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      isComplete ? "bg-primary" : colors.fill
                    )}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
