"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dumbbell, PersonStanding, Bike, Waves, LucideIcon } from "lucide-react";
import { cn, formatDayName, formatDateDisplay } from "@/lib/utils";
import { getActivityColor } from "@/lib/activity-colors";
import { addWorkout } from "@/actions/workouts";
import type { ActivityType } from "@/lib/db/schema";

const iconMap: Record<string, LucideIcon> = {
  Dumbbell,
  PersonStanding,
  Bike,
  Waves,
};

type AddActivityModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  dateString: string;
  activityTypes: ActivityType[];
};

export function AddActivityModal({
  open,
  onOpenChange,
  date,
  dateString,
  activityTypes,
}: AddActivityModalProps) {
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async () => {
    if (!selectedActivity) return;

    setIsPending(true);
    try {
      await addWorkout(selectedActivity, dateString, notes || undefined);
      onOpenChange(false);
      setSelectedActivity(null);
      setNotes("");
    } catch (error) {
      console.error("Failed to add workout:", error);
    } finally {
      setIsPending(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setSelectedActivity(null);
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Dodaj aktywność
            <span className="block text-sm font-normal text-muted-foreground mt-1">
              {formatDayName(date)}, {formatDateDisplay(date)}
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2">
          <div className="grid grid-cols-2 gap-3">
            {activityTypes.map((activity) => {
              const Icon = iconMap[activity.icon] || Dumbbell;
              const isSelected = selectedActivity === activity.id;
              const colors = getActivityColor(activity.name);

              return (
                <button
                  key={activity.id}
                  onClick={() => setSelectedActivity(activity.id)}
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left",
                    isSelected
                      ? cn(colors.bg, colors.border)
                      : "border-border hover:border-muted-foreground/30 bg-white"
                  )}
                >
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                      isSelected ? colors.fill : colors.bg
                    )}
                  >
                    <Icon className={cn("w-5 h-5", isSelected ? "text-white" : colors.text)} />
                  </div>
                  <span className={cn(
                    "font-semibold text-sm",
                    isSelected ? colors.text : "text-foreground"
                  )}>
                    {activity.name}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm font-medium">
              Notatka (opcjonalnie)
            </Label>
            <Input
              id="notes"
              placeholder="np. Dzień nóg, bieganie w deszczu..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-xl h-12"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            onClick={handleClose}
            className="flex-1 h-12 rounded-xl"
          >
            Anuluj
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedActivity || isPending}
            className="flex-[2] h-12 rounded-xl"
          >
            {isPending ? "Dodawanie..." : "Dodaj"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
