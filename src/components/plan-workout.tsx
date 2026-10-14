"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronDown, ClipboardList, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { setPlanChecks, setWorkoutPlanDay, startPlanWorkout } from "@/actions/gym";
import { cn } from "@/lib/utils";

export type DayOption = { id: string; label: string; name: string };
export type ChecklistEntry = { id: string; title: string; detail: string | null };

/** Dashboard: the next plan day to do, or today's gym session if it's already started. */
export function NextWorkoutCard({
  day,
  exerciseNames,
  todayWorkout,
}: {
  day: DayOption;
  exerciseNames: string[];
  todayWorkout: { id: string; label: string | null } | null;
}) {
  const [starting, startTransition] = useTransition();

  // The action redirects to the workout page; the spinner stays until it lands.
  const start = () => {
    startTransition(async () => {
      try {
        await startPlanWorkout(day.id);
      } catch (error) {
        unstable_rethrow(error);
        console.error("Failed to start workout:", error);
        toast.error("Nie udało się zacząć treningu");
      }
    });
  };

  return (
    <Card className="border-border/50">
      <CardContent className="p-4 flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1 basis-56">
          <p className="text-sm text-muted-foreground">
            {todayWorkout ? "Dzisiejszy trening" : "Następny trening"}
          </p>
          <p className="font-semibold">
            {todayWorkout
              ? todayWorkout.label ?? "Siłownia"
              : `${day.label} · ${day.name}`}
          </p>
          {!todayWorkout && (
            <p className="text-sm text-muted-foreground truncate">{exerciseNames.join(", ")}</p>
          )}
        </div>
        <div className="flex gap-2 ml-auto">
          <Link
            href="/plan"
            className="h-10 px-3 rounded-xl border border-border inline-flex items-center gap-1.5 text-sm font-medium hover:bg-accent"
          >
            <ClipboardList className="w-4 h-4" />
            Plan
          </Link>
          {todayWorkout ? (
            <Link
              href={`/trening/${todayWorkout.id}`}
              className="h-10 px-4 rounded-xl bg-primary text-primary-foreground inline-flex items-center gap-1.5 text-sm font-medium hover:bg-primary/90"
            >
              <Play className="w-4 h-4" />
              Kontynuuj
            </Link>
          ) : (
            <Button onClick={start} disabled={starting} className="h-10 rounded-xl px-4">
              {starting ? <Loader2 className="animate-spin" /> : <Play />}
              Zacznij
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** Workout page: which plan day is this session? Shown for a session without one. */
export function PlanDayPicker({
  workoutId,
  days,
  nextId,
}: {
  workoutId: string;
  days: DayOption[];
  nextId: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [picked, setPicked] = useState<string | null>(null);

  const pick = (dayId: string) => {
    setPicked(dayId);
    startTransition(async () => {
      try {
        await setWorkoutPlanDay(workoutId, dayId);
      } catch (error) {
        console.error("Failed to set plan day:", error);
        toast.error("Nie udało się wybrać treningu");
      }
    });
  };

  return (
    <Card className="border-border/50">
      <CardContent className="p-4 space-y-3">
        <p className="text-sm font-semibold">Który trening z planu?</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {days.map((d) => (
            <Button
              key={d.id}
              variant={d.id === nextId ? "default" : "outline"}
              onClick={() => pick(d.id)}
              disabled={pending}
              className={cn(
                "h-auto min-h-11 rounded-xl justify-start whitespace-normal text-left py-2",
                d.id !== nextId && "hover:bg-accent"
              )}
            >
              {pending && picked === d.id && <Loader2 className="animate-spin" />}
              <span>
                <span className="font-semibold">{d.label}</span> · {d.name}
                {d.id === nextId && <span className="block text-xs opacity-80">następny w kolejce</span>}
              </span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/** Warm-up / cardio checklist; ticks are saved on the workout. */
export function PlanChecklist({
  title,
  items,
  checks,
  onChecksChange,
}: {
  title: string;
  items: ChecklistEntry[];
  checks: string[];
  onChecksChange: (checks: string[]) => void;
}) {
  const done = items.filter((i) => checks.includes(i.id)).length;
  const [open, setOpen] = useState(done < items.length);

  if (items.length === 0) return null;
  return (
    <Card className="border-border/50">
      <CardContent className="p-0">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="w-full flex items-center gap-2 px-4 py-3 text-left rounded-xl hover:bg-accent/50"
        >
          <span className="font-semibold">{title}</span>
          <span className="text-sm text-muted-foreground tabular-nums">
            {done}/{items.length}
          </span>
          <ChevronDown
            className={cn("w-4 h-4 ml-auto text-muted-foreground transition-transform", open && "rotate-180")}
          />
        </button>
        {open && (
          <ul className="px-2 pb-2">
            {items.map((item) => {
              const checked = checks.includes(item.id);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    onClick={() =>
                      onChecksChange(
                        checked ? checks.filter((id) => id !== item.id) : [...checks, item.id]
                      )
                    }
                    className="w-full flex items-start gap-3 rounded-lg px-2 py-2 text-left hover:bg-accent/50"
                  >
                    <span
                      className={cn(
                        "mt-0.5 w-5 h-5 shrink-0 rounded-md border flex items-center justify-center",
                        checked ? "bg-primary border-primary text-primary-foreground" : "border-input"
                      )}
                    >
                      {checked && <Check className="w-3.5 h-3.5" />}
                    </span>
                    <span className="min-w-0">
                      <span className={cn("block text-sm font-medium", checked && "text-muted-foreground line-through")}>
                        {item.title}
                      </span>
                      {item.detail && (
                        <span className="block text-xs text-muted-foreground">{item.detail}</span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Owns the ticked ids for both checklists of a session. Local state is the truth
 * once the page loads (server props would lag behind quick taps), and each change
 * sends the full list, so the last save always wins with the latest state.
 */
export function usePlanChecks(workoutId: string, initial: string[]) {
  const [checks, setChecks] = useState(initial);
  const latest = useRef(initial);
  const [, startTransition] = useTransition();

  const update = (next: string[]) => {
    latest.current = next;
    setChecks(next);
    startTransition(async () => {
      try {
        await setPlanChecks(workoutId, latest.current);
      } catch (error) {
        console.error("Failed to save checklist:", error);
        toast.error("Nie udało się zapisać");
      }
    });
  };

  return [checks, update] as const;
}
