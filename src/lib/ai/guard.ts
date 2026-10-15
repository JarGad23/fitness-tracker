import { and, eq, gte, sql } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { db } from "@/lib/db";
import { aiCalls } from "@/lib/db/schema";
import { AI_MODELS, DAILY_LIMIT, DAILY_LIMIT_BY_KIND, estimateCostUsd, type AIKind } from "@/lib/ai/models";
import { AIError, type AIUsage } from "@/lib/ai/provider";

// Every AI call goes through here: the per-user daily limit is checked first and the
// call is logged to ai_calls afterwards, failed ones included (they count too, so a
// retry loop against a broken provider still stops).

const DAY_MS = 24 * 60 * 60 * 1000;

export async function assertWithinLimit(userId: string, kind: AIKind) {
  const since = new Date(Date.now() - DAY_MS);
  const rows = await db
    .select({ kind: aiCalls.kind, count: sql<number>`count(*)` })
    .from(aiCalls)
    .where(and(eq(aiCalls.userId, userId), gte(aiCalls.createdAt, since)))
    .groupBy(aiCalls.kind);

  const total = rows.reduce((sum, r) => sum + r.count, 0);
  const ofKind = rows.find((r) => r.kind === kind)?.count ?? 0;
  const kindLimit = DAILY_LIMIT_BY_KIND[kind];
  if (total >= DAILY_LIMIT || (kindLimit != null && ofKind >= kindLimit)) {
    throw new AIError("daily_limit", `Daily AI limit reached (${kind})`);
  }
}

export async function logAICall(
  userId: string,
  kind: AIKind,
  model: string,
  result: { usage: AIUsage } | { error: unknown }
) {
  const usage = "usage" in result ? result.usage : null;
  await db.insert(aiCalls).values({
    id: uuid(),
    userId,
    kind,
    model,
    inputTokens: usage?.inputTokens ?? null,
    outputTokens: usage?.outputTokens ?? null,
    costUsd: usage ? estimateCostUsd(model, usage.inputTokens, usage.outputTokens) : null,
    ok: usage != null,
    errorCode:
      "error" in result
        ? result.error instanceof AIError
          ? result.error.code
          : "unknown"
        : null,
  });
}

/** Limit check + call + log for one-shot calls. `fn` gets the model for `kind`. */
export async function withAICall<T extends { usage: AIUsage }>(
  userId: string,
  kind: AIKind,
  fn: (model: string) => Promise<T>
): Promise<T> {
  await assertWithinLimit(userId, kind);
  const model = AI_MODELS[kind];
  try {
    const result = await fn(model);
    await logAICall(userId, kind, model, result);
    return result;
  } catch (error) {
    await logAICall(userId, kind, model, { error });
    throw error;
  }
}
