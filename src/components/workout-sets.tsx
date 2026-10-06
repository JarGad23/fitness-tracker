"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { v4 as uuid } from "uuid";
import { Minus, Plus, Trash2, Copy, Loader2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { addExercise, addSet, updateSet, deleteSet, copySetsFrom } from "@/actions/gym";
import { DEFAULT_REPS, WEIGHT_STEP_KG, exerciseKey } from "@/lib/gym";
import { parseLocaleNumber } from "@/lib/health-sync";

export type EditorSet = {
  id: string;
  exerciseId: string;
  exerciseName: string;
  position: number;
  reps: number;
  weightKg: number | null;
};

export type PreviousSession = {
  workoutId: string;
  label: string; // e.g. "śr 24 wrz"
  exerciseNames: string[];
};

type Action =
  | { type: "add"; set: EditorSet }
  | { type: "update"; id: string; reps: number; weightKg: number | null }
  | { type: "delete"; id: string };

function reducer(sets: EditorSet[], action: Action): EditorSet[] {
  switch (action.type) {
    case "add":
      return [...sets, action.set];
    case "update":
      return sets.map((s) =>
        s.id === action.id ? { ...s, reps: action.reps, weightKg: action.weightKg } : s
      );
    case "delete":
      return sets.filter((s) => s.id !== action.id);
  }
}

// Exercises the server doesn't know yet (optimistic add) carry this id prefix.
const PENDING_EXERCISE = "pending:";
const QUICK_PICKS = 6;

function groupByExercise(sets: EditorSet[]) {
  const groups = new Map<string, { id: string; name: string; sets: EditorSet[] }>();
  for (const set of [...sets].sort((a, b) => a.position - b.position)) {
    const group = groups.get(set.exerciseId);
    if (group) group.sets.push(set);
    else groups.set(set.exerciseId, { id: set.exerciseId, name: set.exerciseName, sets: [set] });
  }
  return [...groups.values()];
}

export function WorkoutSets({
  workoutId,
  sets,
  exerciseNames,
  previous,
}: {
  workoutId: string;
  sets: EditorSet[];
  exerciseNames: string[];
  previous: PreviousSession | null;
}) {
  const [optimisticSets, apply] = useOptimistic(sets, reducer);
  const [, startTransition] = useTransition();
  const [copying, startCopy] = useTransition();
  const [newExercise, setNewExercise] = useState("");

  const groups = groupByExercise(optimisticSets);
  const nextPosition = Math.max(-1, ...optimisticSets.map((s) => s.position)) + 1;

  const run = (action: Action, call: () => Promise<unknown>, errorMessage: string) => {
    startTransition(async () => {
      apply(action);
      try {
        await call();
      } catch (error) {
        console.error(errorMessage, error);
        toast.error(errorMessage);
      }
    });
  };

  // Recent exercises not in this workout yet: one tap instead of typing
  // (<datalist> suggestions are unreliable on iOS Safari).
  const quickPicks = exerciseNames
    .filter((name) => !groups.some((g) => exerciseKey(g.name) === exerciseKey(name)))
    .slice(0, QUICK_PICKS);

  const addExerciseByName = (rawName: string) => {
    const name = rawName.trim();
    if (!name) return;
    const known = groups.find((g) => exerciseKey(g.name) === exerciseKey(name));
    const set: EditorSet = {
      id: uuid(),
      exerciseId: known?.id ?? PENDING_EXERCISE + exerciseKey(name),
      exerciseName: known?.name ?? name,
      position: nextPosition,
      reps: known?.sets.at(-1)?.reps ?? DEFAULT_REPS,
      weightKg: known?.sets.at(-1)?.weightKg ?? null,
    };
    run(
      { type: "add", set },
      () => addExercise(workoutId, set.id, name),
      "Nie udało się dodać ćwiczenia"
    );
  };

  const handleSubmitExercise = (event: React.FormEvent) => {
    event.preventDefault();
    addExerciseByName(newExercise);
    setNewExercise("");
  };

  const handleAddSet = (group: ReturnType<typeof groupByExercise>[number]) => {
    const last = group.sets.at(-1)!;
    const set: EditorSet = { ...last, id: uuid(), position: nextPosition };
    run(
      { type: "add", set },
      () => addSet(workoutId, set.id, set.exerciseId, set.reps, set.weightKg),
      "Nie udało się dodać serii"
    );
  };

  const handleUpdate = (set: EditorSet, reps: number, weightKg: number | null) => {
    if (reps === set.reps && weightKg === set.weightKg) return;
    run(
      { type: "update", id: set.id, reps, weightKg },
      () => updateSet(set.id, reps, weightKg),
      "Nie udało się zapisać serii"
    );
  };

  const handleDelete = (set: EditorSet) => {
    run({ type: "delete", id: set.id }, () => deleteSet(set.id), "Nie udało się usunąć serii");
  };

  const handleCopy = (source: PreviousSession) => {
    startCopy(async () => {
      try {
        await copySetsFrom(workoutId, source.workoutId);
      } catch (error) {
        console.error("Failed to copy sets:", error);
        toast.error("Nie udało się skopiować treningu");
      }
    });
  };

  const addExerciseControls = (
    <div className="space-y-2">
      <form onSubmit={handleSubmitExercise} className="flex gap-2">
        <Input
          value={newExercise}
          onChange={(e) => setNewExercise(e.target.value)}
          list="exercise-options"
          placeholder="Nowe ćwiczenie"
          aria-label="Nazwa ćwiczenia"
          maxLength={80}
          className="h-11 rounded-xl bg-card"
        />
        <datalist id="exercise-options">
          {exerciseNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <Button
          type="submit"
          disabled={!newExercise.trim()}
          className="h-11 rounded-xl px-4"
        >
          <Plus />
          Dodaj
        </Button>
      </form>
      {quickPicks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {quickPicks.map((name) => (
            <Button
              key={name}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addExerciseByName(name)}
              className="rounded-full"
            >
              <Plus />
              {name}
            </Button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {groups.length === 0 && previous && (
        <Card className="border-border/50">
          <CardContent className="p-4 space-y-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                Ostatni trening: {previous.label}
              </p>
              <p className="text-sm text-muted-foreground truncate">
                {previous.exerciseNames.join(", ")}
              </p>
            </div>
            <Button
              onClick={() => handleCopy(previous)}
              disabled={copying}
              className="w-full h-11 rounded-xl"
            >
              {copying ? <Loader2 className="animate-spin" /> : <Copy />}
              Powtórz ostatni trening
            </Button>
          </CardContent>
        </Card>
      )}

      {groups.map((group) => {
        const pending = group.id.startsWith(PENDING_EXERCISE);
        return (
          <Card key={group.id} className="border-border/50">
            <CardContent className="p-4 space-y-2">
              {pending ? (
                <p className="font-semibold">{group.name}</p>
              ) : (
                <Link
                  href={`/cwiczenie/${group.id}`}
                  className="flex items-center gap-1 font-semibold hover:text-primary w-fit"
                >
                  {group.name}
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </Link>
              )}

              <div className="grid grid-cols-[1.25rem_1fr_1fr_2rem] items-center gap-x-2 gap-y-2">
                <span />
                <span className="text-xs text-muted-foreground text-center">kg</span>
                <span className="text-xs text-muted-foreground text-center">powt.</span>
                <span />
                {group.sets.map((set, index) => (
                  <SetRow
                    key={set.id}
                    index={index + 1}
                    set={set}
                    onChange={(reps, weightKg) => handleUpdate(set, reps, weightKg)}
                    onDelete={() => handleDelete(set)}
                  />
                ))}
              </div>

              <Button
                variant="outline"
                onClick={() => handleAddSet(group)}
                disabled={pending}
                className="w-full h-10 rounded-xl"
              >
                <Plus />
                Seria
              </Button>
            </CardContent>
          </Card>
        );
      })}

      {groups.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold">Dodaj pierwsze ćwiczenie</p>
              <p className="text-sm text-muted-foreground">
                Kolejne serie zaczynają się od ostatniego ciężaru i powtórzeń.
              </p>
            </div>
            {addExerciseControls}
          </CardContent>
        </Card>
      ) : (
        addExerciseControls
      )}
    </div>
  );
}

function SetRow({
  index,
  set,
  onChange,
  onDelete,
}: {
  index: number;
  set: EditorSet;
  onChange: (reps: number, weightKg: number | null) => void;
  onDelete: () => void;
}) {
  const weight = set.weightKg;
  const stepWeight = (dir: 1 | -1) => {
    const next = Math.max(0, (weight ?? 0) + dir * WEIGHT_STEP_KG);
    onChange(set.reps, next);
  };

  return (
    <>
      <span className="text-sm font-medium text-muted-foreground text-center">{index}</span>
      <Stepper
        label={`Ciężar, seria ${index}`}
        value={weight}
        placeholder="MC"
        onStep={stepWeight}
        onCommit={(raw) => {
          if (raw.trim() === "") {
            onChange(set.reps, null);
            return true;
          }
          const n = parseLocaleNumber(raw);
          if (n == null || n < 0 || n > 1000) return false;
          onChange(set.reps, Math.round(n * 100) / 100);
          return true;
        }}
      />
      <Stepper
        label={`Powtórzenia, seria ${index}`}
        value={set.reps}
        onStep={(dir) => onChange(Math.max(1, set.reps + dir), weight)}
        onCommit={(raw) => {
          const n = Number(raw);
          if (!Number.isInteger(n) || n < 1 || n > 999) return false;
          onChange(n, weight);
          return true;
        }}
        inputMode="numeric"
      />
      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        aria-label={`Usuń serię ${index}`}
        className="text-muted-foreground hover:text-destructive"
      >
        <Trash2 />
      </Button>
    </>
  );
}

function Stepper({
  label,
  value,
  placeholder,
  onStep,
  onCommit,
  inputMode = "decimal",
}: {
  label: string;
  value: number | null;
  placeholder?: string;
  onStep: (dir: 1 | -1) => void;
  // Returns false for invalid input, which puts the previous value back.
  onCommit: (raw: string) => boolean;
  inputMode?: "decimal" | "numeric";
}) {
  const display = value == null ? "" : value.toLocaleString("pl-PL");
  return (
    <div className="flex items-center rounded-xl border border-input bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => onStep(-1)}
        aria-label={`${label}: mniej`}
        className="h-10 w-8 shrink-0 flex items-center justify-center text-muted-foreground hover:bg-muted active:bg-muted"
      >
        <Minus className="w-4 h-4" />
      </button>
      {/* Uncontrolled + keyed by value: +/- remounts it with the new number,
          typing commits on blur or Enter. */}
      <input
        key={display}
        defaultValue={display}
        placeholder={placeholder}
        inputMode={inputMode}
        aria-label={label}
        onBlur={(e) => {
          if (e.target.value !== display && !onCommit(e.target.value)) {
            e.target.value = display;
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className="h-10 w-full min-w-0 bg-transparent text-center text-base font-semibold tabular-nums outline-none placeholder:text-muted-foreground placeholder:font-normal"
      />
      <button
        type="button"
        onClick={() => onStep(1)}
        aria-label={`${label}: więcej`}
        className="h-10 w-8 shrink-0 flex items-center justify-center text-muted-foreground hover:bg-muted active:bg-muted"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}
