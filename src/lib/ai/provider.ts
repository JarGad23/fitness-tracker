import type { ZodType } from "zod";

// Provider-neutral surface for the AI features. Callers never import a vendor SDK, so
// swapping Gemini for another provider means one new implementation of AIProvider.

export type AIUsage = { inputTokens: number; outputTokens: number };

export type ChatMessage = { role: "user" | "model"; content: string };

export type ThinkingLevel = "minimal" | "low" | "medium" | "high";

type BaseOptions = {
  model: string;
  system: string;
  /** Less thinking = faster and cheaper answers; omit for the model's default. */
  thinking?: ThinkingLevel;
};

export interface AIProvider {
  /** One-shot request whose answer must match `schema` (validated, not just typed). */
  generateJson<T>(
    options: BaseOptions & { input: string; schema: ZodType<T> }
  ): Promise<{ data: T; usage: AIUsage }>;

  generateText(options: BaseOptions & { input: string }): Promise<{ text: string; usage: AIUsage }>;

  /** Streams text chunks of the answer to the last user message in `messages`. */
  streamChat(
    options: BaseOptions & { messages: ChatMessage[] }
  ): Promise<{ chunks: AsyncIterable<string>; usage: () => AIUsage }>;
}

export type AIErrorCode =
  | "no_credits" // prepaid balance used up / billing problem
  | "rate_limited" // provider-side rate limit
  | "daily_limit" // our own per-user limit (see guard.ts)
  | "unavailable" // network, timeout, 5xx
  | "invalid_output" // answer didn't match the schema
  | "misconfigured"; // missing/invalid key, unknown model

export class AIError extends Error {
  constructor(
    readonly code: AIErrorCode,
    message: string,
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = "AIError";
  }
}

/** Polish message for the UI. */
export function aiErrorMessage(error: unknown): string {
  if (!(error instanceof AIError)) return "Coś poszło nie tak z AI — spróbuj ponownie";
  switch (error.code) {
    case "no_credits":
      return "Brak środków na AI — doładuj kredyty w Google AI Studio";
    case "rate_limited":
      return "Za dużo zapytań do AI — spróbuj za chwilę";
    case "daily_limit":
      return "Dzienny limit AI wyczerpany — spróbuj jutro";
    case "unavailable":
      return "AI chwilowo niedostępne — spróbuj ponownie";
    case "invalid_output":
      return "AI zwróciło niepoprawną odpowiedź — spróbuj ponownie";
    case "misconfigured":
      return "AI nie jest skonfigurowane (klucz lub model)";
  }
}
