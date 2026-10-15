"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, MessageCircle, RotateCcw, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/markdown";
import { clearCoachChat } from "@/actions/coach";
import { cn } from "@/lib/utils";

export type ChatMessageView = { id: string; role: "user" | "model"; content: string };

const SUGGESTIONS = [
  "Jak mi idzie siłownia w ostatnich tygodniach?",
  "Co powinienem zrobić na następnym treningu?",
  "Jak dziś wygląda moja regeneracja?",
];

// Same limit as the route (MESSAGE_MAX_LENGTH in src/lib/ai/chat.ts, a server module).
const MAX_LENGTH = 2000;

export function CoachChat({ initialMessages }: { initialMessages: ChatMessageView[] }) {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(confirmTimer.current), []);

  // Keep the newest message in view while it streams in.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || sending) return;
    const userMsg: ChatMessageView = { id: crypto.randomUUID(), role: "user", content: message };
    const replyId = crypto.randomUUID();
    setMessages((m) => [...m, userMsg, { id: replyId, role: "model", content: "" }]);
    setInput("");
    setSending(true);

    const setReply = (content: string) =>
      setMessages((m) => m.map((msg) => (msg.id === replyId ? { ...msg, content } : msg)));
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Nie udało się wysłać wiadomości");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let reply = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
        setReply(reply);
      }
      if (!reply.trim()) throw new Error("Trener nie odpowiedział — spróbuj ponownie");
    } catch (error) {
      // Nothing was saved server-side: drop the turn and give the text back.
      setMessages((m) => m.filter((msg) => msg.id !== userMsg.id && msg.id !== replyId));
      setInput(message);
      toast.error(
        error instanceof TypeError
          ? "Brak połączenia — spróbuj ponownie"
          : error instanceof Error
            ? error.message
            : "Coś poszło nie tak"
      );
    } finally {
      setSending(false);
    }
  };

  const handleClear = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      confirmTimer.current = setTimeout(() => setConfirmClear(false), 3000);
      return;
    }
    clearTimeout(confirmTimer.current);
    setConfirmClear(false);
    try {
      await clearCoachChat();
      setMessages([]);
    } catch {
      toast.error("Nie udało się wyczyścić rozmowy");
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3 bg-muted/30 border-b border-border/50">
        <div className="flex items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <MessageCircle className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base font-semibold">Rozmowa z trenerem</CardTitle>
              <p className="text-xs text-muted-foreground truncate">
                Zna Twój plan, brief i dane z ostatnich 4 tygodni
              </p>
            </div>
          </div>
          {messages.length > 0 && (
            <Button
              variant={confirmClear ? "destructive" : "outline"}
              onClick={handleClear}
              disabled={sending}
              className="rounded-xl gap-2 shrink-0"
            >
              <RotateCcw className="w-4 h-4" />
              <span className={confirmClear ? undefined : "hidden sm:inline"}>
                {confirmClear ? "Usunąć?" : "Nowa rozmowa"}
              </span>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted text-left"
              >
                {s}
              </button>
            ))}
          </div>
        ) : (
          <div
            ref={listRef}
            className="max-h-[60vh] overflow-y-auto space-y-3 pr-1"
            aria-live="polite"
          >
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground text-sm whitespace-pre-wrap break-words"
                      : "bg-muted/50 border border-border"
                  )}
                >
                  {m.role === "user" ? (
                    m.content
                  ) : m.content ? (
                    <Markdown>{m.content}</Markdown>
                  ) : (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-end gap-2"
        >
          <Textarea
            aria-label="Wiadomość do trenera"
            placeholder="Zapytaj trenera…"
            value={input}
            maxLength={MAX_LENGTH}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter breaks the line; not while composing (IME).
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            className="min-h-11 max-h-40 resize-none text-base sm:text-sm"
          />
          <Button
            type="submit"
            size="icon"
            disabled={sending || !input.trim()}
            aria-label="Wyślij"
            className="h-11 w-11 rounded-xl shrink-0"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
