import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { coachMessages } from "@/lib/db/schema";
import { loadCoachContext } from "@/lib/ai/context";
import { coachSystemPrompt } from "@/lib/ai/prompts";

// Coach chat. History lives in coach_messages and the newest HISTORY_LIMIT messages go
// to the model each turn (stateless calls, see gemini.ts).

export const HISTORY_LIMIT = 30;
export const CHAT_CONTEXT_WEEKS = 4;
export const MESSAGE_MAX_LENGTH = 2000;

const TASK = `Rozmawiasz z użytkownikiem jako jego trener — odpowiadasz na jego wiadomości.
- Zwięźle: zwykle 2–6 zdań; lista tylko wtedy, gdy porządkuje odpowiedź. Markdown dozwolony, bez nagłówków.
- Odwołuj się do jego danych i planu, gdy to pasuje do pytania; nie streszczaj ich bez potrzeby.
- Nie możesz niczego zmienić w aplikacji (plan, cele, treningi) — jeśli użytkownik o to prosi, powiedz, co i gdzie może zmienić sam.
- Pytania spoza treningu, regeneracji, zdrowia i odżywiania zbywaj jednym zdaniem.`;

/** Oldest first, the newest `limit` messages. */
export async function loadChatMessages(userId: string, limit = HISTORY_LIMIT) {
  const rows = await db.query.coachMessages.findMany({
    where: eq(coachMessages.userId, userId),
    orderBy: [desc(coachMessages.createdAt)],
    limit,
  });
  return rows.reverse();
}

export async function chatSystemPrompt(userId: string, today: string) {
  const context = await loadCoachContext(userId, today, CHAT_CONTEXT_WEEKS);
  return coachSystemPrompt(context, `${TASK}\n\nDziś jest ${today}.`);
}
