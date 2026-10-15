"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, NotebookPen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { saveWorkoutNote } from "@/actions/gym";
import { WORKOUT_NOTE_MAX_LENGTH } from "@/lib/gym";

// Typing pauses this long before the text saves on its own (a phone app can be
// closed without the field ever losing focus).
const SAVE_DELAY_MS = 800;

/**
 * The session's note — what the sets can't say (bench angle, a swapped exercise, how
 * the shoulder felt). Same autosave rules as the day note editor: saves are queued,
 * and server data replaces the text only when nothing is pending or unsaved.
 */
export function WorkoutNoteEditor({ workoutId, note }: { workoutId: string; note: string | null }) {
  const [text, setText] = useState(note ?? "");
  const [savedText, setSavedText] = useState(note ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [pending, setPending] = useState(0);
  // Saves run one after another so a slow request can't land after a newer one.
  const queue = useRef<Promise<void>>(Promise.resolve());
  // Latest text for the timer and blur handlers: they can run before a re-render.
  const latest = useRef(text);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  // The note changed elsewhere (the add-activity modal edits the same field).
  const [trackedNote, setTrackedNote] = useState(note);
  if (note !== trackedNote && pending === 0 && text.trim() === savedText.trim()) {
    setTrackedNote(note);
    setText(note ?? "");
    setSavedText(note ?? "");
  }

  const flush = () => {
    clearTimeout(timer.current);
    const next = latest.current;
    if (next.trim() === savedText.trim()) return;
    setStatus("saving");
    setPending((n) => n + 1);
    queue.current = queue.current
      .then(() => saveWorkoutNote(workoutId, next))
      .then(() => {
        setSavedText(next);
        setStatus("saved");
      })
      .catch(() => {
        setStatus("idle");
        toast.error("Nie udało się zapisać notatki");
      })
      .finally(() => setPending((n) => n - 1));
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3 bg-muted/30 border-b border-border/50">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
            <NotebookPen className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-base font-semibold">Notatka do treningu</CardTitle>
            <p className="text-xs text-muted-foreground truncate">Trener ją widzi</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <Textarea
          aria-label="Notatka do treningu"
          placeholder="np. wyciskanie: hantle, skos 30°; bark OK po rozgrzewce"
          value={text}
          maxLength={WORKOUT_NOTE_MAX_LENGTH}
          onChange={(e) => {
            latest.current = e.target.value;
            setText(e.target.value);
            clearTimeout(timer.current);
            timer.current = setTimeout(flush, SAVE_DELAY_MS);
          }}
          onBlur={flush}
          rows={3}
        />
        <p className="flex h-4 items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
          {status === "saving" ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> Zapisywanie...
            </>
          ) : status === "saved" && text.trim() === savedText.trim() ? (
            <>
              <Check className="h-3 w-3" /> Zapisano
            </>
          ) : null}
        </p>
      </CardContent>
    </Card>
  );
}
