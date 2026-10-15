import { gemini } from "@/lib/ai/gemini";
import type { AIProvider } from "@/lib/ai/provider";

// The one place that picks the provider.
export function getAI(): AIProvider {
  return gemini;
}
