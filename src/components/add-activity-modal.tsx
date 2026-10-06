"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Star,
  X,
  ListChecks,
  Plus,
  Moon,
  HeartPulse,
  Activity,
  Flame,
} from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { cn, capitalizeFirst, toISODateString } from "@/lib/utils";
import { getActivityIcon } from "@/lib/activity-icons";
import {
  resolveActivityColor,
  activityColorStyles,
} from "@/lib/activity-colors";
import { addWorkout, updateWorkout, deleteWorkout } from "@/actions/workouts";
import { DURATION_OPTIONS, durationLabel } from "@/lib/durations";
import type { ActivityType, Workout } from "@/lib/db/schema";
import type { DayNoteValue } from "@/lib/day-notes";
import { DayNoteEditor } from "./day-note-editor";

type WorkoutWithType = Workout & { activityType: ActivityType };

/** One day of Apple Watch data, as shown in the modal's strip. */
export type DayHealth = {
  date: string;
  sleepHours: number | null;
  restingHr: number | null;
  exerciseMinutes: number | null;
  activeCalories: number | null;
};

type AddActivityModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  dateString: string;
  activityTypes: ActivityType[];
  workouts?: WorkoutWithType[];
  // null = the day has no note, undefined = not loaded (the editor fetches it)
  noteFor: (date: string) => DayNoteValue | null | undefined;
  // null = no watch data for that day (or a date outside the loaded range)
  healthFor: (date: string) => DayHealth | null;
};

export function AddActivityModal({
  open,
  onOpenChange,
  date,
  dateString,
  activityTypes,
  workouts = [],
  noteFor,
  healthFor,
}: AddActivityModalProps) {
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(date);
  const [trackedDate, setTrackedDate] = useState(dateString);
  const [dateOpen, setDateOpen] = useState(false);
  const [duration, setDuration] = useState<string | null>(null);
  const [feelingScore, setFeelingScore] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Phones only: the workout form is collapsed until asked for (always shown on md+).
  const [formOpen, setFormOpen] = useState(false);
  const router = useRouter();

  // Strength workouts get their sets logged on their own page.
  const startsStrengthWorkout =
    !editingId &&
    activityTypes.find((a) => a.id === selectedActivity)?.healthKind === "strength";

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
    setFeelingScore(null);
    setNotes("");
    setEditingId(null);
    setFormOpen(false);
  };

  const startEditing = (workout: WorkoutWithType) => {
    setEditingId(workout.id);
    setSelectedActivity(workout.activityTypeId);
    setDuration(workout.duration ?? null);
    setFeelingScore(workout.feelingScore ?? null);
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
          duration || undefined,
          feelingScore ?? undefined
        );
        toast.success("Zapisano zmiany");
      } else {
        const id = await addWorkout(
          selectedActivity,
          toISODateString(selectedDate),
          notes || undefined,
          duration || undefined,
          feelingScore ?? undefined
        );
        if (startsStrengthWorkout) {
          router.push(`/trening/${id}`);
          onOpenChange(false);
        } else {
          toast.success("Dodano aktywność");
        }
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

  const dateISO = toISODateString(selectedDate);
  const health = healthFor(dateISO);
  const showForm = formOpen || editingId !== null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[calc(100%-1rem)] sm:max-w-3xl rounded-3xl p-5 sm:p-7 max-h-[92dvh] overflow-y-auto gap-5">
        <DialogHeader className="pr-8">
          <div className="flex items-center gap-2">
            <DialogTitle className="text-xl">
              {capitalizeFirst(format(selectedDate, "EEEE, d MMMM", { locale: pl }))}
            </DialogTitle>
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger
                aria-label="Zmień dzień"
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground aria-expanded:bg-muted"
              >
                <CalendarIcon className="w-4 h-4" />
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
        </DialogHeader>

        {health && <DayHealthStrip health={health} />}

        <div className="grid gap-6 md:grid-cols-2 md:gap-8">
          <section className="space-y-5 min-w-0">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Aktywności</h3>
              {dayWorkouts.length > 0 ? (
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
                          {workout.activityType.healthKind === "strength" && (
                            <Link
                              href={`/trening/${workout.id}`}
                              aria-label="Serie"
                              className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-primary"
                            >
                              <ListChecks className="w-4 h-4" />
                            </Link>
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
              ) : (
                <p className="text-sm text-muted-foreground">Brak treningów tego dnia.</p>
              )}
            </div>

            <div className="space-y-2">
              <div>
                <h3 className="text-sm font-semibold">Jak minął dzień?</h3>
                <p className="text-xs text-muted-foreground">
                  Zapisuje się samo — nie musisz wybierać treningu.
                </p>
              </div>
              <DayNoteEditor key={dateISO} date={dateISO} note={noteFor(dateISO)} />
            </div>

            {!showForm && (
              <Button
                variant="outline"
                onClick={() => setFormOpen(true)}
                className="w-full h-12 rounded-xl md:hidden"
              >
                <Plus />
                Dodaj trening
              </Button>
            )}
          </section>

          <section
            className={cn(
              "space-y-5 min-w-0 md:border-l md:border-border md:pl-8",
              !showForm && "hidden md:block"
            )}
          >
            <h3 className="text-sm font-semibold">
              {editingId ? "Edytuj trening" : "Dodaj trening"}
            </h3>
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
              <Label className="text-sm font-medium">
                Samopoczucie (opcjonalnie)
              </Label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((score) => {
                  const active = feelingScore !== null && score <= feelingScore;
                  return (
                    <button
                      key={score}
                      type="button"
                      onClick={() =>
                        setFeelingScore(feelingScore === score ? null : score)
                      }
                      aria-label={`Samopoczucie ${score} z 5`}
                      aria-pressed={active}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-input bg-card transition-colors hover:bg-muted"
                    >
                      <Star
                        className={cn(
                          "w-5 h-5 transition-colors",
                          active
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-muted-foreground"
                        )}
                      />
                    </button>
                  );
                })}
                {feelingScore !== null && (
                  <span className="ml-1 text-sm text-muted-foreground">
                    {feelingScore}/5
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-sm font-medium">
                Notatka do aktywności (opcjonalnie)
              </Label>
              <Textarea
                id="notes"
                placeholder="np. Dzień nóg, bieganie w deszczu..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex gap-3">
              {showForm && (
                <Button
                  variant="outline"
                  onClick={resetState}
                  disabled={isPending}
                  className="flex-1 h-12 rounded-xl"
                >
                  <X className="w-4 h-4" />
                  Anuluj
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
                    : startsStrengthWorkout
                      ? "Rozpocznij trening"
                      : "Dodaj"}
              </Button>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// 6.8 → "6 h 48 min", 7 → "7 h"
function formatSleep(hours: number) {
  const total = Math.round(hours * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

const HEALTH_TILES = [
  { key: "sleepHours", label: "Sen", icon: Moon, format: formatSleep },
  { key: "restingHr", label: "Tętno spocz.", icon: HeartPulse, format: (v: number) => `${v} bpm` },
  { key: "exerciseMinutes", label: "Ruch", icon: Activity, format: (v: number) => `${v} min` },
  { key: "activeCalories", label: "Kalorie", icon: Flame, format: (v: number) => `${v} kcal` },
] as const;

function DayHealthStrip({ health }: { health: DayHealth }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Dane z Apple Watch">
      {HEALTH_TILES.map(({ key, label, icon: Icon, format }) => {
        const value = health[key];
        return (
          <div key={key} className="rounded-xl bg-muted/50 px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icon className="w-3.5 h-3.5" />
              {label}
            </p>
            <p className="mt-0.5 text-base font-semibold tabular-nums">
              {value == null ? "—" : format(value)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
