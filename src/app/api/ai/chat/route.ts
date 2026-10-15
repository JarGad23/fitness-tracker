import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { coachMessages } from "@/lib/db/schema";
import { getAI } from "@/lib/ai";
import { chatSystemPrompt, loadChatMessages, MESSAGE_MAX_LENGTH } from "@/lib/ai/chat";
import { assertWithinLimit, logAICall } from "@/lib/ai/guard";
import { AI_MODELS, AI_THINKING } from "@/lib/ai/models";
import { AIError, aiErrorMessage } from "@/lib/ai/provider";
import { todayISO } from "@/lib/utils";

// POST { message } → the coach's answer streamed as plain text. A Route Handler, not a
// Server Action, because the answer streams. Both messages are saved only once the
// answer is complete, so a failed turn leaves no half-conversation behind.
// Errors before the stream starts come back as JSON { error } with a non-2xx status.

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Nie jesteś zalogowany" }, { status: 401 });

  let message: unknown;
  try {
    ({ message } = (await request.json()) as { message?: unknown });
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe dane" }, { status: 400 });
  }
  if (typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "Pusta wiadomość" }, { status: 400 });
  }
  if (message.length > MESSAGE_MAX_LENGTH) {
    return NextResponse.json({ error: "Wiadomość jest za długa" }, { status: 400 });
  }
  const text = message.trim();
  const sentAt = new Date();

  const model = AI_MODELS.chat;
  let answer: Awaited<ReturnType<ReturnType<typeof getAI>["streamChat"]>>;
  try {
    await assertWithinLimit(userId, "chat");
    const [system, history] = await Promise.all([
      chatSystemPrompt(userId, todayISO()),
      loadChatMessages(userId),
    ]);
    answer = await getAI().streamChat({
      model,
      system,
      thinking: AI_THINKING.chat,
      messages: [
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: text },
      ],
    });
  } catch (error) {
    console.error("chat failed before streaming:", error);
    // A call refused by our own limit never reached the provider: not logged (as in withAICall).
    if (!(error instanceof AIError && error.code === "daily_limit")) {
      await logAICall(userId, "chat", model, { error });
    }
    const status = error instanceof AIError && error.code === "daily_limit" ? 429 : 502;
    return NextResponse.json({ error: aiErrorMessage(error) }, { status });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let reply = "";
      try {
        for await (const chunk of answer.chunks) {
          reply += chunk;
          controller.enqueue(encoder.encode(chunk));
        }
        await logAICall(userId, "chat", model, { usage: answer.usage() });
        if (reply.trim()) {
          await db.insert(coachMessages).values([
            { id: uuid(), userId, role: "user", content: text, createdAt: sentAt },
            { id: uuid(), userId, role: "model", content: reply.trim(), createdAt: new Date() },
          ]);
        }
        controller.close();
      } catch (error) {
        console.error("chat stream failed:", error);
        await logAICall(userId, "chat", model, { error });
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
