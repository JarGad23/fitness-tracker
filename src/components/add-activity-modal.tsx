"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Calendar as CalendarIcon,
  Clock,
  Trash2,
  Loader2,
} from "lucide-react";
import {
  cn,
  formatDayName,
  formatDateDisplay,
  toISODateString,
} from "@/lib/utils";
import { getActivityIcon } from "@/lib/activity-icons";
import {
  resolveActivityColor,
  activityColorStyles,
} from "@/lib/activity-colors";
import { addWorkout, deleteWorkout } from "@/actions/workouts";
import type { ActivityType, Workout } from "@/lib/db/schema";

type WorkoutWithType = Workout & { activityType: ActivityType };

const DURATION_OPTIONS = [
  { value: "15-30", label: "15–30 min" },
  { value: "30-45", label: "30–45 min" },
  { value: "45-60", label: "45 min – 1 h" },
  { value: "60-90", label: "1 – 1,5 h" },
  { value: "90-120", label: "1,5 – 2 h" },
];

const durationLabel = (value: string | null) =>
  DURATION_OPTIONS.find((o) => o.value === value)?.label ?? value;

type AddActivityModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  dateString: string;
  activityTypes: ActivityType[];
  workouts?: WorkoutWithType[];
};

export function AddActivityModal({
  open,
  onOpenChange,
  date,
  dateString,
  activityTypes,
  workouts = [],
}: AddActivityModalProps) {
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(date);
  const [trackedDate, setTrackedDate] = useState(dateString);
  const [dateOpen, setDateOpen] = useState(false);
  const [duration, setDuration] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Reset the picked date when the modal opens for a different day
  // (derive-on-prop-change, no effect needed).
  if (dateString !== trackedDate) {
    setTrackedDate(dateString);
    setSelectedDate(date);
  }

  const dayWorkouts = workouts.filter(
    (w) => w.date === toISODateString(selectedDate)
  );

  const resetState = () => {
    setSelectedActivity(null);
    setDuration(null);
    setNotes("");
  };

  const handleSubmit = async () => {
    if (!selectedActivity) return;

    setIsPending(true);
    try {
      await addWorkout(
        selectedActivity,
        toISODateString(selectedDate),
        notes || undefined,
        duration || undefined
      );
      resetState();
      toast.success("Dodano aktywność");
    } catch (error) {
      console.error("Failed to add workout:", error);
      toast.error("Nie udało się dodać aktywności");
    } finally {
      setIsPending(false);
    }
  };

  const handleDelete = async (workoutId: string) => {
    setDeletingId(workoutId);
    try {
      await deleteWorkout(workoutId);
      toast.success("Usunięto aktywność");
    } catch (error) {
      console.error("Failed to delete workout:", error);
      toast.error("Nie udało się usunąć aktywności");
    } finally {
      setDeletingId(null);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    resetState();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md rounded-3xl p-6 max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Aktywności</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Data</Label>
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger className="flex h-12 w-full items-center gap-3 rounded-xl border border-input bg-card px-4 text-left text-sm font-medium transition-colors hover:bg-muted aria-expanded:bg-muted">
                <CalendarIcon className="w-5 h-5 text-muted-foreground shrink-0" />
                <span className="capitalize">
                  {formatDayName(selectedDate)}, {formatDateDisplay(selectedDate)}
                </span>
              </PopoverTrigger>
              <PopoverContent align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  defaultMonth={selectedDate}
                  disabled={{ after: new Date() }}
                  onSelect={(d) => {
                    if (!d) return;
                    setSelectedDate(d);
                    setDateOpen(false);
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          {dayWorkouts.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Dodane aktywności</Label>
              <div className="space-y-2">
                {dayWorkouts.map((workout) => {
                  const Icon = getActivityIcon(workout.activityType.icon);
                  const hex = resolveActivityColor(workout.activityType);
                  const styles = activityColorStyles(hex);
                  const isDeleting = deletingId === workout.id;

                  return (
                    <div
                      key={workout.id}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
                    >
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                        style={styles.soft}
                      >
                        <Icon className="w-4 h-4" style={styles.text} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                          {workout.activityType.name}
                          {workout.duration && (
                            <span className="font-normal text-muted-foreground">
                              {" · "}
                              {durationLabel(workout.duration)}
                            </span>
                          )}
                        </p>
                        {workout.notes && (
                          <p className="text-xs text-muted-foreground truncate">
                            {workout.notes}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDelete(workout.id)}
                        disabled={isDeleting}
                        aria-label="Usuń aktywność"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        {isDeleting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-sm font-medium">Dodaj aktywność</Label>
            <div className="grid grid-cols-2 gap-3">
              {activityTypes.map((activity) => {
                const Icon = getActivityIcon(activity.icon);
                const isSelected = selectedActivity === activity.id;
                const hex = resolveActivityColor(activity);
                const styles = activityColorStyles(hex);

                return (
                  <button
                    key={activity.id}
                    type="button"
                    onClick={() => setSelectedActivity(activity.id)}
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left",
                      !isSelected &&
                        "border-border bg-card hover:border-muted-foreground/30"
                    )}
                    style={
                      isSelected ? { ...styles.soft, ...styles.border } : undefined
                    }
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                      style={isSelected ? styles.solid : styles.soft}
                    >
                      <Icon
                        className="w-5 h-5"
                        style={isSelected ? { color: "#ffffff" } : styles.text}
                      />
                    </div>
                    <span
                      className="font-semibold text-sm"
                      style={isSelected ? styles.text : undefined}
                    >
                      {activity.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Czas trwania (opcjonalnie)
            </Label>
            <Select
              value={duration}
              onValueChange={(value) => setDuration(value)}
            >
              <SelectTrigger>
                {duration ? (
                  <span className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    {durationLabel(duration)}
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    Wybierz czas trwania
                  </span>
                )}
              </SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm font-medium">
              Notatka (opcjonalnie)
            </Label>
            <Textarea
              id="notes"
              placeholder="np. Dzień nóg, bieganie w deszczu..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            onClick={handleClose}
            className="flex-1 h-12 rounded-xl"
          >
            Zamknij
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
