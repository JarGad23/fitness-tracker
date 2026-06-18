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
  ChevronDown,
  StickyNote,
  Pencil,
  X,
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
import { addWorkout, updateWorkout, deleteWorkout } from "@/actions/workouts";
import { DURATION_OPTIONS, durationLabel } from "@/lib/durations";
import type { ActivityType, Workout } from "@/lib/db/schema";

type WorkoutWithType = Workout & { activityType: ActivityType };

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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Reset the picked date when the modal opens for a different day
  // (derive-on-prop-change, no effect needed).
  if (dateString !== trackedDate) {
    setTrackedDate(dateString);
    setSelectedDate(date);
    setEditingId(null);
  }

  const dayWorkouts = workouts.filter(
    (w) => w.date === toISODateString(selectedDate)
  );

  const resetState = () => {
    setSelectedActivity(null);
    setDuration(null);
    setNotes("");
    setEditingId(null);
  };

  const startEditing = (workout: WorkoutWithType) => {
    setEditingId(workout.id);
    setSelectedActivity(workout.activityTypeId);
    setDuration(workout.duration ?? null);
    setNotes(workout.notes ?? "");
    setExpandedId(null);
  };

  const handleSubmit = async () => {
    if (!selectedActivity) return;

    setIsPending(true);
    try {
      if (editingId) {
        await updateWorkout(
          editingId,
          selectedActivity,
          notes || undefined,
          duration || undefined
        );
        toast.success("Zapisano zmiany");
      } else {
        await addWorkout(
          selectedActivity,
          toISODateString(selectedDate),
          notes || undefined,
          duration || undefined
        );
        toast.success("Dodano aktywność");
      }
      resetState();
    } catch (error) {
      console.error("Failed to save workout:", error);
      toast.error(
        editingId
          ? "Nie udało się zapisać zmian"
          : "Nie udało się dodać aktywności"
      );
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
                  const dur = durationLabel(workout.duration);
                  const hasNotes = Boolean(workout.notes);
                  const isExpanded = expandedId === workout.id;
                  const isEditing = editingId === workout.id;

                  return (
                    <div
                      key={workout.id}
                      className={cn(
                        "rounded-xl border border-border bg-card",
                        isEditing && "ring-2 ring-primary/50"
                      )}
                    >
                      <div className="flex items-center gap-3 p-3">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                          style={styles.soft}
                        >
                          <Icon className="w-4 h-4" style={styles.text} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {workout.activityType.name}
                          </p>
                          {dur && (
                            <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {dur}
                            </span>
                          )}
                        </div>
                        {hasNotes && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() =>
                              setExpandedId(isExpanded ? null : workout.id)
                            }
                            aria-label={
                              isExpanded ? "Ukryj notatkę" : "Pokaż notatkę"
                            }
                            aria-expanded={isExpanded}
                            className="text-muted-foreground"
                          >
                            <ChevronDown
                              className={cn(
                                "w-4 h-4 transition-transform",
                                isExpanded && "rotate-180"
                              )}
                            />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => startEditing(workout)}
                          disabled={isDeleting}
                          aria-label="Edytuj aktywność"
                          className={cn(
                            "text-muted-foreground hover:text-primary",
                            isEditing && "text-primary"
                          )}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
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
                      {hasNotes && isExpanded && (
                        <div className="flex gap-2 border-t border-border px-3 py-2.5 text-sm text-muted-foreground">
                          <StickyNote className="w-4 h-4 shrink-0 mt-0.5" />
                          <p className="whitespace-pre-wrap break-words">
                            {workout.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {editingId ? "Edytuj aktywność" : "Dodaj aktywność"}
            </Label>
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
          {editingId ? (
            <Button
              variant="outline"
              onClick={resetState}
              disabled={isPending}
              className="flex-1 h-12 rounded-xl"
            >
              <X className="w-4 h-4" />
              Anuluj
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={handleClose}
              className="flex-1 h-12 rounded-xl"
            >
              Zamknij
            </Button>
          )}
          <Button
            onClick={handleSubmit}
            disabled={!selectedActivity || isPending}
            className="flex-[2] h-12 rounded-xl"
          >
            {isPending
              ? editingId
                ? "Zapisywanie..."
                : "Dodawanie..."
              : editingId
                ? "Zapisz"
                : "Dodaj"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
