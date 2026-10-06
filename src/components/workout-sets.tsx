"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { parseISO, format } from "date-fns";
import { pl } from "date-fns/locale";
import { toast } from "sonner";
import { v4 as uuid } from "uuid";
import { Minus, Plus, Trash2, Copy, Loader2, ChevronRight, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  addExercise,
  addSet,
  updateSet,
  deleteSet,
  copySetsFrom,
  renameExercise,
} from "@/actions/gym";
import { DEFAULT_REPS, WEIGHT_STEP_KG, exerciseKey, formatWeight } from "@/lib/gym";
import { parseLocaleNumber } from "@/lib/health-sync";
import { pluralPl } from "@/lib/utils";

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

/** One of the user's exercises with its newest set outside this workout. */
export type ExerciseOption = {
  id: string;
  name: string;
  lastDate: string | null;
  lastReps: number | null;
  lastWeightKg: number | null;
};

type Action =
  | { type: "add"; set: EditorSet }
  | { type: "update"; id: string; reps: number; weightKg: number | null }
  | { type: "delete"; id: string }
  | { type: "rename"; fromId: string; toId: string; name: string };

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
    case "rename":
      return sets.map((s) =>
        s.exerciseId === action.fromId || s.exerciseId === action.toId
          ? { ...s, exerciseId: action.toId, exerciseName: action.name }
          : s
      );
  }
}

const QUICK_PICKS = 6;

type Group = { id: string; name: string; sets: EditorSet[] };

function groupByExercise(sets: EditorSet[]): Group[] {
  const groups = new Map<string, Group>();
  for (const set of [...sets].sort((a, b) => a.position - b.position)) {
    const group = groups.get(set.exerciseId);
    if (group) group.sets.push(set);
    else groups.set(set.exerciseId, { id: set.exerciseId, name: set.exerciseName, sets: [set] });
  }
  return [...groups.values()];
}

function cleanName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

export function WorkoutSets({
  workoutId,
  sets,
  exercises,
  previous,
}: {
  workoutId: string;
  sets: EditorSet[];
  exercises: ExerciseOption[];
  previous: PreviousSession | null;
}) {
  const [optimisticSets, apply] = useOptimistic(sets, reducer);
  const [, startTransition] = useTransition();
  const [copying, startCopy] = useTransition();
  const [newExercise, setNewExercise] = useState("");

  const groups = groupByExercise(optimisticSets);
  const nextPosition = Math.max(-1, ...optimisticSets.map((s) => s.position)) + 1;
  const byKey = new Map(exercises.map((e) => [exerciseKey(e.name), e]));
  const byId = new Map(exercises.map((e) => [e.id, e]));

  // Recent exercises not in this workout yet: one tap instead of typing
  // (<datalist> suggestions are unreliable on iOS Safari).
  const quickPicks = exercises
    .filter((e) => !groups.some((g) => g.id === e.id))
    .slice(0, QUICK_PICKS);

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

  // The id and the prefill are decided here, so the new card is fully usable at once
  // and nothing jumps when the server answers.
  const addExerciseByName = (rawName: string) => {
    const name = cleanName(rawName);
    if (!name) return;
    const inWorkout = groups.find((g) => exerciseKey(g.name) === exerciseKey(name));
    const known = byKey.get(exerciseKey(name));
    const lastHere = inWorkout?.sets.at(-1);
    const set: EditorSet = {
      id: uuid(),
      exerciseId: inWorkout?.id ?? known?.id ?? uuid(),
      exerciseName: inWorkout?.name ?? known?.name ?? name,
      position: nextPosition,
      reps: lastHere?.reps ?? known?.lastReps ?? DEFAULT_REPS,
      weightKg: lastHere ? lastHere.weightKg : (known?.lastWeightKg ?? null),
    };
    run(
      { type: "add", set },
      () =>
        addExercise(workoutId, set.id, set.exerciseId, set.exerciseName, set.reps, set.weightKg),
      "Nie udało się dodać ćwiczenia"
    );
  };

  const handleSubmitExercise = (event: React.FormEvent) => {
    event.preventDefault();
    addExerciseByName(newExercise);
    setNewExercise("");
  };

  const handleAddSet = (group: Group) => {
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

  // Renaming to a name the user already has merges into that exercise.
  const handleRename = (group: Group, rawName: string) => {
    const name = cleanName(rawName);
    if (!name || name === group.name) return;
    const twin = byKey.get(exerciseKey(name));
    const toId = twin && twin.id !== group.id ? twin.id : group.id;
    run(
      { type: "rename", fromId: group.id, toId, name: toId === group.id ? name : twin!.name },
      () => renameExercise(group.id, name),
      "Nie udało się zmienić nazwy"
    );
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

  const setCount = optimisticSets.length;
  const tonnage = optimisticSets.reduce((sum, s) => sum + (s.weightKg ?? 0) * s.reps, 0);

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
          {exercises.map((e) => (
            <option key={e.id} value={e.name} />
          ))}
        </datalist>
        <Button type="submit" disabled={!newExercise.trim()} className="h-11 rounded-xl px-4">
          <Plus />
          Dodaj
        </Button>
      </form>
      {quickPicks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {quickPicks.map((e) => (
            <Button
              key={e.id}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addExerciseByName(e.name)}
              className="rounded-full hover:bg-accent"
            >
              <Plus />
              {e.name}
            </Button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {groups.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {groups.length} {pluralPl(groups.length, ["ćwiczenie", "ćwiczenia", "ćwiczeń"])}
          {" · "}
          {setCount} {pluralPl(setCount, ["seria", "serie", "serii"])}
          {tonnage > 0 && ` · ${Math.round(tonnage).toLocaleString("pl-PL")} kg`}
        </p>
      )}

      {groups.length === 0 && previous && (
        <Card className="border-border/50">
          <CardContent className="p-4 space-y-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Ostatni trening: {previous.label}</p>
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

      {groups.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          {groups.map((group) => (
            <ExerciseCard
              key={group.id}
              group={group}
              last={byId.get(group.id) ?? null}
              onRename={(name) => handleRename(group, name)}
              onAddSet={() => handleAddSet(group)}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {groups.length === 0 ? (
        <Card className="border-border/50 lg:max-w-xl">
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
        <div className="lg:max-w-[calc(50%-0.5rem)]">{addExerciseControls}</div>
      )}
    </div>
  );
}

function ExerciseCard({
  group,
  last,
  onRename,
  onAddSet,
  onUpdate,
  onDelete,
}: {
  group: Group;
  last: ExerciseOption | null;
  onRename: (name: string) => void;
  onAddSet: () => void;
  onUpdate: (set: EditorSet, reps: number, weightKg: number | null) => void;
  onDelete: (set: EditorSet) => void;
}) {
  const [editing, setEditing] = useState(false);
  // Enter blurs the field, and a phone keyboard can blur it again: commit once.
  const committed = useRef(false);

  return (
    <Card className="border-border/50">
      <CardContent className="p-4 space-y-2">
        {editing ? (
          <Input
            autoFocus
            defaultValue={group.name}
            aria-label="Nowa nazwa ćwiczenia"
            maxLength={80}
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                e.currentTarget.value = group.name;
                e.currentTarget.blur();
              }
            }}
            onBlur={(e) => {
              if (committed.current) return;
              committed.current = true;
              onRename(e.currentTarget.value);
              setEditing(false);
            }}
            className="h-9 rounded-lg font-semibold"
          />
        ) : (
          <div className="flex items-center gap-1">
            <Link
              href={`/cwiczenie/${group.id}`}
              className="flex min-w-0 items-center gap-1 font-semibold hover:text-primary"
            >
              <span className="truncate">{group.name}</span>
              <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />
            </Link>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                committed.current = false;
                setEditing(true);
              }}
              aria-label={`Zmień nazwę: ${group.name}`}
              className="ml-auto text-muted-foreground hover:bg-accent hover:text-primary"
            >
              <Pencil className="w-4 h-4" />
            </Button>
          </div>
        )}

        {last?.lastDate && last.lastReps != null && (
          <p className="text-xs text-muted-foreground">
            Ostatnio ({format(parseISO(last.lastDate), "d MMM", { locale: pl })}):{" "}
            {formatWeight(last.lastWeightKg)} × {last.lastReps}
          </p>
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
              onChange={(reps, weightKg) => onUpdate(set, reps, weightKg)}
              onDelete={() => onDelete(set)}
            />
          ))}
        </div>

        <Button
          variant="outline"
          onClick={onAddSet}
          className="w-full h-10 rounded-xl hover:bg-accent"
        >
          <Plus />
          Seria
        </Button>
      </CardContent>
    </Card>
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
        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
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
        className="h-10 w-8 shrink-0 flex items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:bg-accent"
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
        className="h-10 w-8 shrink-0 flex items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:bg-accent"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}
