// Runs an AI coach task against real data and prints the answer, usage and cost.
// Read-only: nothing is written (not even the ai_calls log) — for tuning prompts.
//   npx tsx --env-file=.env scripts/ai-dry-run.ts <email> context
//   npx tsx --env-file=.env scripts/ai-dry-run.ts <email> ask "Jak mi idzie klatka?"
//   npx tsx --env-file=.env scripts/ai-dry-run.ts <email> report [YYYY-MM-DD as today]
//   npx tsx --env-file=.env scripts/ai-dry-run.ts <email> comment [workoutId, default: newest gym session]
//   npx tsx --env-file=.env scripts/ai-dry-run.ts <email> plan [YYYY-MM-DD as today]
import { eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { users } from "../src/lib/db/schema";
import { getAI } from "../src/lib/ai";
import { loadCoachContext } from "../src/lib/ai/context";
import { coachSystemPrompt } from "../src/lib/ai/prompts";
import { AI_MODELS, AI_THINKING, estimateCostUsd } from "../src/lib/ai/models";
import type { AIUsage } from "../src/lib/ai/provider";
import { todayISO } from "../src/lib/utils";
import { draftWeeklyReport } from "../src/lib/ai/report";
import { commentWorkout } from "../src/lib/ai/comment";
import { draftPlanRevision } from "../src/lib/ai/plan-revision";
import { workouts, workoutSets } from "../src/lib/db/schema";
import { and, desc, inArray } from "drizzle-orm";

function printUsage(model: string, usage: AIUsage, ms: number) {
  const cost = estimateCostUsd(model, usage.inputTokens, usage.outputTokens);
  console.log(
    `\n— ${model}: ${usage.inputTokens} in / ${usage.outputTokens} out (incl. thinking), ` +
      `~$${cost?.toFixed(4) ?? "?"}, ${(ms / 1000).toFixed(1)} s`
  );
}

async function main() {
  const [email, task, ...rest] = process.argv.slice(2);
  if (!email || !task) {
    console.error("Usage: ai-dry-run.ts <email> <context|ask|report|comment|plan> [args]");
    process.exit(1);
  }

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) throw new Error(`No user ${email}`);

  const today = todayISO();

  if (task === "context") {
    const context = await loadCoachContext(user.id, today, 8);
    const system = coachSystemPrompt(context, "(zadanie)");
    console.log(system);
    console.log(`\n— ${system.length} chars, ~${Math.round(system.length / 3.5)} tokens (rough)`);
  } else if (task === "ask") {
    const question = rest.join(" ");
    const context = await loadCoachContext(user.id, today, 4);
    const model = AI_MODELS.chat;
    const started = performance.now();
    const { text, usage } = await getAI().generateText({
      model,
      thinking: AI_THINKING.chat,
      system: coachSystemPrompt(context, "Odpowiedz na pytanie użytkownika."),
      input: question,
    });
    console.log(text);
    printUsage(model, usage, performance.now() - started);
  } else if (task === "report") {
    const started = performance.now();
    const { report, usage } = await draftWeeklyReport(user.id, rest[0] ?? today, { dryRun: true });
    console.log(`Okres: ${report.periodStart} – ${report.periodEnd}\n`);
    console.log(report.body);
    console.log("\nCele:", JSON.stringify(report.targets));
    printUsage(report.model, usage, performance.now() - started);
  } else if (task === "comment") {
    // Default: the newest workout with sets.
    const workoutId =
      rest[0] ??
      (
        await db.query.workouts.findFirst({
          where: and(
            eq(workouts.userId, user.id),
            inArray(workouts.id, db.selectDistinct({ id: workoutSets.workoutId }).from(workoutSets))
          ),
          orderBy: [desc(workouts.date), desc(workouts.createdAt)],
        })
      )?.id;
    if (!workoutId) throw new Error("No workout with sets");
    const started = performance.now();
    const result = await commentWorkout(user.id, workoutId, { dryRun: true });
    if ("error" in result) throw new Error(result.error);
    console.log(result.input, "\n\n---\n");
    console.log(result.comment);
    printUsage(AI_MODELS.comment, result.usage!, performance.now() - started);
  } else if (task === "plan") {
    const started = performance.now();
    const draft = await draftPlanRevision(user.id, rest[0] ?? today, { dryRun: true });
    if (!draft) throw new Error("No training plan");
    const names = new Map(
      draft.plan.days.flatMap((d) => d.exercises.map((e) => [e.id, `${d.label}: ${e.exercise.name}`]))
    );
    console.log(draft.revision.summary, "\n");
    console.log(`Changes: ${draft.revision.changes.length} valid of ${draft.rawCount}`);
    for (const c of draft.revision.changes) {
      const target = c.planExerciseId ? names.get(c.planExerciseId) : `${c.dayLabel}: (new)`;
      const fields = Object.entries({ name: c.exerciseName, unit: c.unit, sets: c.sets, repMin: c.repMin, repMax: c.repMax, tips: c.tips, alternative: c.alternative })
        .filter(([, v]) => v != null)
        .map(([k, v]) => `${k}=${v}`)
        .join(" ");
      console.log(`\n[${c.type}] ${target} ${fields}\n  ${c.reason}`);
    }
    printUsage(draft.revision.model, draft.usage, performance.now() - started);
  } else {
    console.error(`Unknown task: ${task}`);
    process.exit(1);
  }
}

main().then(() => process.exit(0), (error) => {
  console.error(error);
  process.exit(1);
});
