"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { parseISO, format } from "date-fns";
import { pl } from "date-fns/locale";
import { toast } from "sonner";
import { v4 as uuid } from "uuid";
import { Minus, Plus, Trash2, Copy, Loader2, ChevronRight, Pencil, Check } from "lucide-react";
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
  setWorkoutPlanDay,
} from "@/actions/gym";
import {
  DEFAULT_REPS,
  WEIGHT_STEP_KG,
  exerciseKey,
  findSimilarExercise,
  formatReps,
  matchExercises,
  formatWeight,
  type ExerciseUnit,
} from "@/lib/gym";
import { formatRepRange, type PlannedSet, type Suggestion } from "@/lib/plan";
import {
  PlanChecklist,
  PlanDayPicker,
  usePlanChecks,
  type ChecklistEntry,
  type DayOption,
} from "@/components/plan-workout";
import { parseLocaleNumber } from "@/lib/health-sync";
import { cn, pluralPl } from "@/lib/utils";

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
  unit: ExerciseUnit;
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

/** One exercise of the session's plan day, with the double-progression suggestion. */
export type PlanItem = {
  id: string;
  exerciseId: string;
  exerciseName: string;
  unit: ExerciseUnit;
  sets: number;
  repMin: number;
  repMax: number;
  superset: number | null;
  alternative: string | null;
  tips: string | null;
  suggestion: Suggestion;
};

export type WorkoutPlan = {
  dayLabel: string;
  dayName: string;
  items: PlanItem[];
  warmup: ChecklistEntry[];
  cardio: ChecklistEntry[];
  checks: string[];
};

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
  plan,
  dayChoice,
}: {
  workoutId: string;
  sets: EditorSet[];
  exercises: ExerciseOption[];
  previous: PreviousSession | null;
  plan: WorkoutPlan | null;
  // Plan days to pick from: the session has none yet and nothing logged.
  dayChoice: { days: DayOption[]; nextId: string | null } | null;
}) {
  const [optimisticSets, apply] = useOptimistic(sets, reducer);
  const [, startTransition] = useTransition();
  const [copying, startCopy] = useTransition();
  const [clearingDay, startClearDay] = useTransition();
  const [newExercise, setNewExercise] = useState("");
  // "Czy chodziło o…?": a typed name that looks like a typo of an existing exercise.
  const [similar, setSimilar] = useState<{ typed: string; match: ExerciseOption } | null>(null);
  // Edits to not-yet-done plan sets, keyed "planItemId:setIndex". Client-only: a
  // planned set becomes a real one only when ticked off.
  const [ghostEdits, setGhostEdits] = useState<Record<string, PlannedSet>>({});
  const [checks, setChecks] = usePlanChecks(workoutId, plan?.checks ?? []);

  const groups = groupByExercise(optimisticSets);
  const nextPosition = Math.max(-1, ...optimisticSets.map((s) => s.position)) + 1;
  const byKey = new Map(exercises.map((e) => [exerciseKey(e.name), e]));
  const byId = new Map(exercises.map((e) => [e.id, e]));

  // Typed text → matching exercises (own list: <datalist> is unreliable on iOS Safari).
  const suggestions = newExercise.trim() ? matchExercises(newExercise, exercises) : [];
  // Recent exercises not in this workout yet: one tap instead of typing.
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

  // A near-miss of an existing name asks first; nothing is merged without a tap.
  const handleSubmitExercise = (event: React.FormEvent) => {
    event.preventDefault();
    const name = cleanName(newExercise);
    if (!name) return;
    const match = findSimilarExercise(name, exercises);
    if (match) {
      setSimilar({ typed: name, match });
      return;
    }
    addExerciseByName(name);
    setNewExercise("");
  };

  const pickExercise = (name: string) => {
    addExerciseByName(name);
    setNewExercise("");
    setSimilar(null);
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

  // Not-done plan sets: the suggestion, but once a set is logged the rest follow its
  // weight (picked 77,5 instead of 80 → the next ones offer 77,5 too).
  const ghostsFor = (item: PlanItem, logged: EditorSet[]) =>
    Array.from({ length: Math.max(0, item.sets - logged.length) }, (_, i) => {
      const index = logged.length + i;
      const base = item.suggestion.sets[index] ?? item.suggestion.sets.at(-1)!;
      const lastLogged = logged.at(-1);
      return (
        ghostEdits[`${item.id}:${index}`] ?? {
          reps: base.reps,
          weightKg: lastLogged ? lastLogged.weightKg : base.weightKg,
        }
      );
    });

  const handleConfirmGhost = (item: PlanItem, index: number, value: PlannedSet) => {
    const set: EditorSet = {
      id: uuid(),
      exerciseId: item.exerciseId,
      exerciseName: item.exerciseName,
      position: nextPosition,
      reps: value.reps,
      weightKg: value.weightKg,
    };
    setGhostEdits((edits) => {
      const rest = { ...edits };
      delete rest[`${item.id}:${index}`];
      return rest;
    });
    run(
      { type: "add", set },
      () => addSet(workoutId, set.id, set.exerciseId, set.reps, set.weightKg),
      "Nie udało się zapisać serii"
    );
  };

  const handleClearDay = () => {
    startClearDay(async () => {
      try {
        await setWorkoutPlanDay(workoutId, null);
      } catch (error) {
        console.error("Failed to clear plan day:", error);
        toast.error("Nie udało się zmienić treningu");
      }
    });
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
  const plannedSetCount = plan?.items.reduce((sum, i) => sum + i.sets, 0) ?? 0;
  const tonnage = optimisticSets.reduce((sum, s) => sum + (s.weightKg ?? 0) * s.reps, 0);

  // Cards: plan exercises in plan order (supersets as one block), then anything added
  // outside the plan in the order it was logged.
  type CardEntry = { key: string; group: Group; unit: ExerciseUnit; item: PlanItem | null; label: string | null };
  const groupById = new Map(groups.map((g) => [g.id, g]));
  const planIds = new Set(plan?.items.map((i) => i.exerciseId));
  const blocks: CardEntry[][] = [];
  let letterIndex = 0;
  plan?.items.forEach((item, i) => {
    const group = groupById.get(item.exerciseId) ?? { id: item.exerciseId, name: item.exerciseName, sets: [] };
    const prev = plan.items[i - 1];
    const joinsPrev = item.superset != null && prev?.superset === item.superset;
    letterIndex = joinsPrev ? letterIndex + 1 : 0;
    const next = plan.items[i + 1];
    const inSuperset = joinsPrev || (item.superset != null && next?.superset === item.superset);
    const blockNo = blocks.length + (joinsPrev ? 0 : 1);
    const entry: CardEntry = {
      key: item.id,
      group,
      unit: item.unit,
      item,
      label: inSuperset ? `${blockNo}${"abcdef"[letterIndex]}` : `${blockNo}`,
    };
    if (joinsPrev) blocks.at(-1)!.push(entry);
    else blocks.push([entry]);
  });
  for (const group of groups) {
    if (planIds.has(group.id)) continue;
    blocks.push([{ key: group.id, group, unit: byId.get(group.id)?.unit ?? "reps", item: null, label: null }]);
  }

  const renderCard = ({ key, group, unit, item, label }: CardEntry) => (
    <ExerciseCard
      key={key}
      group={group}
      unit={unit}
      label={label}
      plan={item}
      ghosts={item ? ghostsFor(item, group.sets) : []}
      last={byId.get(group.id) ?? null}
      onRename={(name) => handleRename(group, name)}
      onAddSet={() => handleAddSet(group)}
      onUpdate={handleUpdate}
      onDelete={handleDelete}
      onGhostChange={(index, value) =>
        item && setGhostEdits((edits) => ({ ...edits, [`${item.id}:${index}`]: value }))
      }
      onGhostConfirm={(index, value) => item && handleConfirmGhost(item, index, value)}
    />
  );

  const addExerciseControls = (
    <div className="space-y-2">
      <form onSubmit={handleSubmitExercise} className="flex gap-2">
        <Input
          value={newExercise}
          onChange={(e) => {
            setNewExercise(e.target.value);
            setSimilar(null);
          }}
          placeholder="Nowe ćwiczenie"
          aria-label="Nazwa ćwiczenia"
          autoComplete="off"
          maxLength={80}
          className="h-11 rounded-xl bg-card"
        />
        <Button
          type="submit"
          disabled={!newExercise.trim() || similar != null}
          className="h-11 rounded-xl px-4"
        >
          <Plus />
          Dodaj
        </Button>
      </form>

      {similar ? (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-3 space-y-2">
          <p className="text-sm">
            Czy chodziło o: <span className="font-semibold">{similar.match.name}</span>?
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => pickExercise(similar.match.name)}
              className="h-9 rounded-xl px-3"
            >
              Tak, użyj tego
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => pickExercise(similar.typed)}
              className="h-9 rounded-xl px-3 max-w-full hover:bg-accent"
            >
              <span className="truncate">Nie, dodaj „{similar.typed}”</span>
            </Button>
          </div>
        </div>
      ) : newExercise.trim() ? (
        suggestions.length > 0 && (
          // While typing, matching exercises replace the recent chips.
          <ul aria-label="Pasujące ćwiczenia" className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border/50">
            {suggestions.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => pickExercise(e.name)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-accent"
                >
                  <Plus className="w-4 h-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 truncate">{e.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )
      ) : quickPicks.length > 0 && (
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
      {plan && (
        <div className="flex items-center gap-2">
          <p className="min-w-0 text-sm">
            <span className="font-semibold">Trening {plan.dayLabel}</span>
            <span className="text-muted-foreground"> · {plan.dayName}</span>
          </p>
          {setCount === 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearDay}
              disabled={clearingDay}
              className="ml-auto shrink-0 text-muted-foreground hover:bg-accent"
            >
              {clearingDay && <Loader2 className="animate-spin" />}
              Zmień
            </Button>
          )}
        </div>
      )}

      {(groups.length > 0 || plan) && (
        <p className="text-sm text-muted-foreground">
          {plan
            ? `${setCount} z ${plannedSetCount} serii`
            : `${groups.length} ${pluralPl(groups.length, ["ćwiczenie", "ćwiczenia", "ćwiczeń"])} · ${setCount} ${pluralPl(setCount, ["seria", "serie", "serii"])}`}
          {tonnage > 0 && ` · ${Math.round(tonnage).toLocaleString("pl-PL")} kg`}
        </p>
      )}

      {dayChoice && (
        <PlanDayPicker workoutId={workoutId} days={dayChoice.days} nextId={dayChoice.nextId} />
      )}

      {plan && (
        <PlanChecklist
          title="Rozgrzewka"
          items={plan.warmup}
          checks={checks}
          onChecksChange={setChecks}
        />
      )}

      {groups.length === 0 && !plan && previous && (
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

      {blocks.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          {blocks.map((block) =>
            block.length === 1 ? (
              renderCard(block[0])
            ) : (
              <div
                key={block[0].key}
                className="rounded-2xl border-2 border-dashed border-primary/30 p-2 space-y-2"
              >
                <p className="px-2 pt-1 text-xs font-semibold uppercase tracking-wide text-primary">
                  Superseria — bez przerwy między ćwiczeniami
                </p>
                {block.map(renderCard)}
              </div>
            )
          )}
        </div>
      )}

      {plan && (
        <PlanChecklist
          title="Cardio po treningu"
          items={plan.cardio}
          checks={checks}
          onChecksChange={setChecks}
        />
      )}

      {groups.length === 0 && !plan ? (
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
  unit,
  label,
  plan,
  ghosts,
  last,
  onRename,
  onAddSet,
  onUpdate,
  onDelete,
  onGhostChange,
  onGhostConfirm,
}: {
  group: Group;
  unit: ExerciseUnit;
  label: string | null; // "5a" in a plan
  plan: PlanItem | null;
  ghosts: PlannedSet[]; // planned sets not done yet
  last: ExerciseOption | null;
  onRename: (name: string) => void;
  onAddSet: () => void;
  onUpdate: (set: EditorSet, reps: number, weightKg: number | null) => void;
  onDelete: (set: EditorSet) => void;
  onGhostChange: (index: number, value: PlannedSet) => void;
  onGhostConfirm: (index: number, value: PlannedSet) => void;
}) {
  const [editing, setEditing] = useState(false);
  // Enter blurs the field, and a phone keyboard can blur it again: commit once.
  const committed = useRef(false);
  const repStep = unit === "sec" ? 5 : 1;

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
            {label && (
              <span className="mr-1 shrink-0 text-sm font-semibold text-muted-foreground tabular-nums">
                {label}.
              </span>
            )}
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

        {plan && (
          <div className="space-y-1">
            <p className="text-sm">
              <span className="font-semibold tabular-nums">
                {plan.sets} × {formatRepRange(plan, unit)}
              </span>
              {plan.suggestion.hint && (
                <span className="text-muted-foreground"> · {plan.suggestion.hint}</span>
              )}
            </p>
            {plan.alternative && (
              <p className="text-xs text-muted-foreground">Zamiennik: {plan.alternative}</p>
            )}
            {plan.tips && (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer select-none hover:text-foreground">
                  Technika
                </summary>
                <p className="mt-1">{plan.tips}</p>
              </details>
            )}
          </div>
        )}

        {last?.lastDate && last.lastReps != null && (
          <p className="text-xs text-muted-foreground">
            Ostatnio ({format(parseISO(last.lastDate), "d MMM", { locale: pl })}):{" "}
            {unit === "sec" && last.lastWeightKg == null
              ? formatReps(last.lastReps, unit)
              : `${formatWeight(last.lastWeightKg)} × ${formatReps(last.lastReps, unit)}`}
          </p>
        )}

        <div className="grid grid-cols-[1.25rem_1fr_1fr_2rem] items-center gap-x-2 gap-y-2">
          <span />
          <span className="text-xs text-muted-foreground text-center">kg</span>
          <span className="text-xs text-muted-foreground text-center">
            {unit === "sec" ? "sek." : "powt."}
          </span>
          <span />
          {group.sets.map((set, index) => (
            <SetRow
              key={set.id}
              index={index + 1}
              value={set}
              repStep={repStep}
              onChange={(reps, weightKg) => onUpdate(set, reps, weightKg)}
              action={
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(set)}
                  aria-label={`Usuń serię ${index + 1}`}
                  className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 />
                </Button>
              }
            />
          ))}
          {ghosts.map((ghost, i) => {
            const index = group.sets.length + i;
            return (
              <SetRow
                key={`ghost-${index}`}
                index={index + 1}
                value={ghost}
                repStep={repStep}
                pending
                onChange={(reps, weightKg) => onGhostChange(index, { reps, weightKg })}
                action={
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onGhostConfirm(index, ghost)}
                    aria-label={`Zapisz serię ${index + 1}`}
                    className="border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground"
                  >
                    <Check />
                  </Button>
                }
              />
            );
          })}
        </div>

        {ghosts.length === 0 && group.sets.length > 0 && (
          <Button
            variant="outline"
            onClick={onAddSet}
            className="w-full h-10 rounded-xl hover:bg-accent"
          >
            <Plus />
            Seria
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function SetRow({
  index,
  value,
  repStep,
  pending = false,
  onChange,
  action,
}: {
  index: number;
  value: PlannedSet;
  repStep: number;
  // A planned set not done yet: dimmed, its edits stay on the client until ticked.
  pending?: boolean;
  onChange: (reps: number, weightKg: number | null) => void;
  action: React.ReactNode;
}) {
  const weight = value.weightKg;
  const stepWeight = (dir: 1 | -1) => {
    const next = Math.max(0, (weight ?? 0) + dir * WEIGHT_STEP_KG);
    onChange(value.reps, next);
  };

  return (
    <>
      <span
        className={cn(
          "text-sm font-medium text-muted-foreground text-center",
          pending && "opacity-60"
        )}
      >
        {index}
      </span>
      <Stepper
        label={`Ciężar, seria ${index}`}
        value={weight}
        // A planned set without a weight yet asks for one; a logged empty one is bodyweight.
        placeholder={pending ? "kg" : "MC"}
        pending={pending}
        onStep={stepWeight}
        onCommit={(raw) => {
          if (raw.trim() === "") {
            onChange(value.reps, null);
            return true;
          }
          const n = parseLocaleNumber(raw);
          if (n == null || n < 0 || n > 1000) return false;
          onChange(value.reps, Math.round(n * 100) / 100);
          return true;
        }}
      />
      <Stepper
        label={`Powtórzenia, seria ${index}`}
        value={value.reps}
        pending={pending}
        onStep={(dir) => onChange(Math.max(1, value.reps + dir * repStep), weight)}
        onCommit={(raw) => {
          const n = Number(raw);
          if (!Number.isInteger(n) || n < 1 || n > 999) return false;
          onChange(n, weight);
          return true;
        }}
        inputMode="numeric"
      />
      {action}
    </>
  );
}

function Stepper({
  label,
  value,
  placeholder,
  pending = false,
  onStep,
  onCommit,
  inputMode = "decimal",
}: {
  label: string;
  value: number | null;
  placeholder?: string;
  pending?: boolean;
  onStep: (dir: 1 | -1) => void;
  // Returns false for invalid input, which puts the previous value back.
  onCommit: (raw: string) => boolean;
  inputMode?: "decimal" | "numeric";
}) {
  const display = value == null ? "" : value.toLocaleString("pl-PL");
  return (
    <div
      className={cn(
        "flex items-center rounded-xl border bg-card overflow-hidden",
        pending ? "border-dashed border-input bg-muted/40 text-muted-foreground" : "border-input"
      )}
    >
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
