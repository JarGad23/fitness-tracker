// Imports a training plan from JSON for one user.
//   npx tsx --env-file=.env scripts/seed-plan.ts <email> scripts/plans/fbw-abc.json
// Exercise names are matched to the user's existing ones (case-insensitive, Polish
// letters included); missing ones are created. Everything goes in one batch, so a
// failed run leaves nothing behind. Refuses a plan name the user already has.
// The app caches the plan ("use cache"): restart `npm run dev` after seeding locally.
import { readFileSync } from "node:fs";
import { v4 as uuid } from "uuid";
import { and, eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { db } from "../src/lib/db";
import {
  users,
  exercises,
  trainingPlans,
  planDays,
  planExercises,
  planChecklist,
} from "../src/lib/db/schema";
import { exerciseKey } from "../src/lib/gym";

type Unit = "reps" | "sec";
type Section = "warmup" | "cardio" | "home";
type ChecklistItem = { title: string; detail?: string };
type PlanFile = {
  name: string;
  days: {
    label: string;
    name: string;
    exercises: {
      name: string;
      unit?: Unit;
      sets: number;
      repMin: number;
      repMax: number;
      superset?: number;
      alternative?: string;
      tips?: string;
    }[];
  }[];
  checklist?: Partial<Record<Section, ChecklistItem[]>>;
  notes?: { title: string; body: string }[];
};

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function validate(plan: PlanFile) {
  const isText = (v: unknown, max = 500) => typeof v === "string" && v.trim() !== "" && v.length <= max;
  const isCount = (v: unknown, max: number) => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= max;
  if (!isText(plan.name, 120)) fail("name: required");
  if (!Array.isArray(plan.days) || plan.days.length === 0) fail("days: at least one");
  for (const day of plan.days) {
    if (!isText(day.label, 4) || !isText(day.name, 80)) fail(`day ${day.label}: label/name`);
    if (!Array.isArray(day.exercises) || day.exercises.length === 0) fail(`day ${day.label}: no exercises`);
    for (const e of day.exercises) {
      const where = `day ${day.label}, "${e.name}"`;
      if (!isText(e.name, 80)) fail(`${where}: name`);
      if (e.unit && e.unit !== "reps" && e.unit !== "sec") fail(`${where}: unit`);
      if (!isCount(e.sets, 20) || !isCount(e.repMin, 999) || !isCount(e.repMax, 999)) fail(`${where}: sets/reps`);
      if (e.repMin > e.repMax) fail(`${where}: repMin > repMax`);
      if (e.superset != null && !isCount(e.superset, 99)) fail(`${where}: superset`);
    }
  }
  for (const [section, items] of Object.entries(plan.checklist ?? {})) {
    if (!["warmup", "cardio", "home"].includes(section)) fail(`checklist: unknown section ${section}`);
    for (const item of items ?? []) if (!isText(item.title, 120)) fail(`checklist ${section}: title`);
  }
  for (const note of plan.notes ?? []) {
    if (!isText(note.title, 80) || !isText(note.body, 5000)) fail("notes: title/body");
  }
}

async function main() {
  const [email, file] = process.argv.slice(2);
  if (!email || !file) fail("Usage: seed-plan.ts <email> <plan.json>");

  const plan = JSON.parse(readFileSync(file, "utf8")) as PlanFile;
  validate(plan);

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) fail(`No user ${email}`);
  const duplicate = await db.query.trainingPlans.findFirst({
    where: and(eq(trainingPlans.userId, user.id), eq(trainingPlans.name, plan.name)),
  });
  if (duplicate) fail(`Plan "${plan.name}" already exists for this user`);

  const own = await db.query.exercises.findMany({ where: eq(exercises.userId, user.id) });
  const byKey = new Map(own.map((e) => [exerciseKey(e.name), e]));
  const statements: BatchItem<"sqlite">[] = [];
  const created: string[] = [];

  // One id per distinct name across days: "Wspięcia na łydki" in A and C is one exercise.
  const exerciseIdFor = (name: string, unit: Unit) => {
    const known = byKey.get(exerciseKey(name));
    if (known) {
      if (known.unit !== unit) {
        statements.push(db.update(exercises).set({ unit }).where(eq(exercises.id, known.id)));
        known.unit = unit;
      }
      return known.id;
    }
    const row = { id: uuid(), userId: user.id, name: name.trim(), unit, createdAt: new Date() };
    statements.push(db.insert(exercises).values(row));
    byKey.set(exerciseKey(name), row);
    created.push(row.name);
    return row.id;
  };

  const planId = uuid();
  statements.push(
    db.insert(trainingPlans).values({ id: planId, userId: user.id, name: plan.name, notes: plan.notes ?? [] })
  );
  plan.days.forEach((day, dayIndex) => {
    const dayId = uuid();
    statements.push(
      db.insert(planDays).values({ id: dayId, planId, label: day.label, name: day.name, position: dayIndex })
    );
    day.exercises.forEach((e, position) => {
      statements.push(
        db.insert(planExercises).values({
          id: uuid(),
          planDayId: dayId,
          exerciseId: exerciseIdFor(e.name, e.unit ?? "reps"),
          position,
          sets: e.sets,
          repMin: e.repMin,
          repMax: e.repMax,
          superset: e.superset ?? null,
          alternative: e.alternative ?? null,
          tips: e.tips ?? null,
        })
      );
    });
  });
  for (const [section, items] of Object.entries(plan.checklist ?? {}) as [Section, ChecklistItem[]][]) {
    items.forEach((item, position) => {
      statements.push(
        db.insert(planChecklist).values({
          id: uuid(),
          planId,
          section,
          position,
          title: item.title,
          detail: item.detail ?? null,
        })
      );
    });
  }

  // Batch keeps the order (plan → day → new exercise → plan row, so every foreign key
  // exists when it's referenced) and runs as one transaction.
  const [first, ...rest] = statements;
  await db.batch([first, ...rest]);

  console.log(`Plan "${plan.name}" imported: ${plan.days.length} days, ${statements.length} statements.`);
  console.log(created.length > 0 ? `New exercises: ${created.join(", ")}` : "No new exercises.");
}

main();
