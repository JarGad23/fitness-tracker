import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import {
  AIError,
  type AIProvider,
  type AIUsage,
  type ChatMessage,
  type ThinkingLevel,
} from "@/lib/ai/provider";

// Gemini through the Interactions API. Every call is stateless (`store: false`): chat
// history lives in our database and is sent whole each turn, so health data isn't
// kept on Google's side (stored interactions are retained for 55 days).

let client: GoogleGenAI | null = null;

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AIError("misconfigured", "GEMINI_API_KEY is not set");
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

type GeminiUsage = { total_input_tokens?: number; total_output_tokens?: number; total_thought_tokens?: number };

// Thinking tokens are billed as output, so they count as output here.
const toUsage = (usage: GeminiUsage | undefined): AIUsage => ({
  inputTokens: usage?.total_input_tokens ?? 0,
  outputTokens: (usage?.total_output_tokens ?? 0) + (usage?.total_thought_tokens ?? 0),
});

const BILLING_RE = /credit|billing|prepa|balance|payment/i;

function toAIError(error: unknown): AIError {
  if (error instanceof AIError) return error;
  const status = (error as { status?: number })?.status;
  const message = error instanceof Error ? error.message : String(error);
  if (status === 402 || ((status === 429 || status === 403) && BILLING_RE.test(message))) {
    return new AIError("no_credits", message, { cause: error });
  }
  if (status === 429) return new AIError("rate_limited", message, { cause: error });
  if (status === 400 || status === 401 || status === 403 || status === 404) {
    return new AIError("misconfigured", message, { cause: error });
  }
  return new AIError("unavailable", message, { cause: error });
}

const generationConfig = (thinking: ThinkingLevel | undefined) =>
  thinking ? { generation_config: { thinking_level: thinking } } : {};

const toSteps = (messages: ChatMessage[]) =>
  messages.map((m) => ({
    type: m.role === "user" ? ("user_input" as const) : ("model_output" as const),
    content: [{ type: "text" as const, text: m.content }],
  }));

// Gemini takes a subset of JSON Schema; the `$schema` key is just noise for it.
function toGeminiSchema(schema: z.ZodType) {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

export const gemini: AIProvider = {
  async generateJson({ model, system, input, schema, thinking }) {
    let interaction;
    try {
      interaction = await getClient().interactions.create({
        model,
        store: false,
        system_instruction: system,
        ...generationConfig(thinking),
        input,
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: toGeminiSchema(schema),
        },
      });
    } catch (error) {
      throw toAIError(error);
    }
    const usage = toUsage(interaction.usage);
    let parsed: unknown;
    try {
      parsed = JSON.parse(interaction.output_text ?? "");
    } catch (error) {
      throw new AIError("invalid_output", "Answer is not JSON", { cause: error });
    }
    const result = schema.safeParse(parsed);
    if (!result.success) {
      throw new AIError("invalid_output", z.prettifyError(result.error), { cause: result.error });
    }
    return { data: result.data, usage };
  },

  async generateText({ model, system, input, thinking }) {
    try {
      const interaction = await getClient().interactions.create({
        model,
        store: false,
        system_instruction: system,
        ...generationConfig(thinking),
        input,
      });
      return { text: (interaction.output_text ?? "").trim(), usage: toUsage(interaction.usage) };
    } catch (error) {
      throw toAIError(error);
    }
  },

  async streamChat({ model, system, messages, thinking }) {
    const stream = await getClient()
      .interactions.create({
        model,
        store: false,
        stream: true,
        system_instruction: system,
        ...generationConfig(thinking),
        input: toSteps(messages),
      })
      .catch((error: unknown) => {
        throw toAIError(error);
      });

    let usage: AIUsage = { inputTokens: 0, outputTokens: 0 };
    async function* chunks() {
      try {
        for await (const event of stream) {
          if (event.event_type === "step.delta" && event.delta.type === "text") {
            yield event.delta.text;
          } else if (event.event_type === "interaction.completed") {
            usage = toUsage(event.interaction.usage);
          } else if (event.event_type === "error") {
            throw new AIError("unavailable", JSON.stringify(event));
          }
        }
      } catch (error) {
        throw toAIError(error);
      }
    }
    return { chunks: chunks(), usage: () => usage };
  },
};
