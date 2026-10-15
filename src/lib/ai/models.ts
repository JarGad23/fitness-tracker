import type { ThinkingLevel } from "@/lib/ai/provider";

// Which model each AI feature uses, and what it costs. Prices are USD per 1M tokens
// on the paid tier (ai.google.dev/gemini-api/docs/pricing, checked 2026-10-15);
// thinking tokens are billed as output. Used only to log an estimated cost.

export type AIKind = "report" | "comment" | "chat" | "plan";

export const AI_MODELS: Record<AIKind, string> = {
  report: "gemini-3.8-flash",
  comment: "gemini-3.8-flash",
  chat: "gemini-3.8-flash",
  plan: "gemini-4-argon",
};

// Interactive features think less so answers come back fast; the rare, heavier tasks
// keep the model's default.
export const AI_THINKING: Partial<Record<AIKind, ThinkingLevel>> = {
  chat: "low",
  comment: "low",
};

type Price = { input: number; output: number; until?: string };

// Several models get a price step on a fixed date: the first entry whose `until` is
// still ahead applies.
const PRICES: Record<string, Price[]> = {
  "gemini-3.8-flash": [
    { input: 0.75, output: 3.75, until: "2027-01-01" },
    { input: 1.5, output: 7.5 },
  ],
  "gemini-4-argon": [
    { input: 2, output: 10, until: "2026-12-01" },
    { input: 4, output: 20 },
  ],
  "gemini-3.5-flash-lite": [{ input: 0.3, output: 2.5 }],
};

export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
  now = new Date()
): number | null {
  const today = now.toISOString().slice(0, 10);
  const price = PRICES[model]?.find((p) => !p.until || today < p.until);
  if (!price) return null;
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}

// Calls per user in a rolling 24 h window. The prepaid balance is the hard cap on
// money; this keeps a bug or a stuck button from draining it.
export const DAILY_LIMIT = 40;
export const DAILY_LIMIT_BY_KIND: Partial<Record<AIKind, number>> = { plan: 3 };
