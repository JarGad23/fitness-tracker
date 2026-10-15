// Synthetic 5 weeks of plan sessions for a throwaway user (stage 5 test). Deleted after.
import { and, eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { db } from "../src/lib/db";
import { users, activityTypes, trainingPlans, workouts, workoutSets, dayNotes } from "../src/lib/db/schema";
import { loadTrainingPlan } from "../src/lib/ai/context";

async function main() {
  const user = (await db.query.users.findFirst({ where: eq(users.email, process.argv[2]) }))!;
  const gym = (await db.query.activityTypes.findFirst({
    where: and(eq(activityTypes.userId, user.id), eq(activityTypes.healthKind, "strength")),
  }))!;
  const plan = (await loadTrainingPlan(user.id))!;
  await db.update(trainingPlans).set({ createdAt: new Date("2026-09-06T08:00:00Z") }).where(eq(trainingPlans.id, plan.id));

  const dates = ["2026-09-08", "2026-09-10", "2026-09-12", "2026-09-15", "2026-09-17", "2026-09-19", "2026-09-22", "2026-09-24", "2026-09-26", "2026-09-29", "2026-10-01", "2026-10-03", "2026-10-06", "2026-10-08", "2026-10-10"];
  const counts: Record<string, number> = {};
  for (const [i, date] of dates.entries()) {
    const day = plan.days[i % 3];
    const n = (counts[day.label] = (counts[day.label] ?? 0) + 1);
    const workoutId = uuid();
    await db.insert(workouts).values({ id: workoutId, userId: user.id, activityTypeId: gym.id, date, planDayId: day.id, duration: "60-75" });
    let position = 0;
    for (const e of day.exercises) {
      const name = e.exercise.name;
      if (/face pull/i.test(name)) continue; // always skipped
      let sets: { reps: number; weightKg: number | null }[];
      if (/sztangi na ławce/i.test(name)) sets = [6, 6, 5, 5].map((reps) => ({ reps, weightKg: 80 })); // stuck
      else if (e.exercise.unit === "sec") sets = Array.from({ length: e.sets }, () => ({ reps: 45 + n * 5, weightKg: null }));
      else {
        const reps = Math.min(e.repMax, e.repMin + n - 1);
        const base = /suwnic/i.test(name) ? 140 : /podciąganie/i.test(name) ? null : 20;
        sets = Array.from({ length: e.sets }, () => ({ reps, weightKg: base }));
      }
      for (const s of sets) {
        await db.insert(workoutSets).values({ id: uuid(), workoutId, exerciseId: e.exerciseId, position: position++, reps: s.reps, weightKg: s.weightKg });
      }
    }
    if (day.label === "A") {
      await db.insert(dayNotes).values({ id: uuid(), userId: user.id, date, tags: ["pain"], text: "Prawy bark kłuje przy wyciskaniu sztangi, ostatnie serie na siłę" });
    }
  }
  console.log("seeded", dates.length, "sessions");
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
