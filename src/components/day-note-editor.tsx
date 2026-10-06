"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { loadDayNote, saveDayNote } from "@/actions/day-notes";
import { DAY_NOTE_MAX_LENGTH, DAY_TAGS, type DayNoteValue } from "@/lib/day-notes";
import { cn } from "@/lib/utils";

type Status = "idle" | "saving" | "saved";

// Typing pauses this long before the text saves on its own (a phone app can be
// closed without the field ever losing focus).
const TEXT_SAVE_DELAY_MS = 800;

const sameNote = (a: DayNoteValue | null, b: DayNoteValue | null) =>
  (a?.text ?? "") === (b?.text ?? "") &&
  (a?.tags ?? []).join() === (b?.tags ?? []).join();

/**
 * Tags save on tap, text saves on blur. `note` is the day's note as the page loaded
 * it: `null` = no note, `undefined` = not loaded (a date outside the page's range) —
 * then it is fetched first, so a save can never overwrite a note it hasn't seen.
 * Parents key this by date.
 */
export function DayNoteEditor({ date, note }: { date: string; note: DayNoteValue | null | undefined }) {
  const [loaded, setLoaded] = useState(note !== undefined);
  const [tags, setTags] = useState<string[]>(note?.tags ?? []);
  const [text, setText] = useState(note?.text ?? "");
  const [status, setStatus] = useState<Status>("idle");
  const [savedText, setSavedText] = useState(note?.text ?? "");
  const [pending, setPending] = useState(0);
  // Saves run one after another so a slow request can't land after a newer one.
  const queue = useRef<Promise<void>>(Promise.resolve());
  // Latest values for handlers: several taps can run before React re-renders.
  const latest = useRef({ tags, text });
  const textTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(textTimer.current), []);
  useEffect(() => {
    latest.current = { tags, text };
  }, [tags, text]);

  // Server data changed (e.g. the same day edited in the modal): take it over — but
  // only when idle. Mid-save the server still has older data, and unsaved typing
  // must never be replaced by it.
  const [trackedNote, setTrackedNote] = useState(note);
  if (
    note !== undefined &&
    pending === 0 &&
    text.trim() === savedText.trim() &&
    !sameNote(note, trackedNote ?? null)
  ) {
    setTrackedNote(note);
    setTags(note?.tags ?? []);
    setText(note?.text ?? "");
    setSavedText(note?.text ?? "");
  }

  useEffect(() => {
    if (note !== undefined) return;
    let cancelled = false;
    loadDayNote(date)
      .then((loadedNote) => {
        if (cancelled) return;
        setTags(loadedNote?.tags ?? []);
        setText(loadedNote?.text ?? "");
        setSavedText(loadedNote?.text ?? "");
        setLoaded(true);
      })
      .catch(() => toast.error("Nie udało się wczytać notatki"));
    return () => {
      cancelled = true;
    };
  }, [date, note]);

  const save = (nextTags: string[], nextText: string) => {
    setStatus("saving");
    setPending((n) => n + 1);
    queue.current = queue.current
      .then(() => saveDayNote(date, nextTags, nextText))
      .then(() => {
        setSavedText(nextText);
        setStatus("saved");
      })
      .catch(() => {
        setStatus("idle");
        toast.error("Nie udało się zapisać notatki");
      })
      .finally(() => setPending((n) => n - 1));
  };

  const flushText = () => {
    clearTimeout(textTimer.current);
    const { tags: currentTags, text: currentText } = latest.current;
    if (currentText.trim() !== savedText.trim()) save(currentTags, currentText);
  };

  const toggleTag = (key: string) => {
    clearTimeout(textTimer.current); // this save carries the current text too
    const current = latest.current.tags;
    const next = current.includes(key) ? current.filter((t) => t !== key) : [...current, key];
    latest.current = { ...latest.current, tags: next };
    setTags(next);
    save(next, latest.current.text);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {DAY_TAGS.map((tag) => {
          const active = tags.includes(tag.key);
          return (
            <button
              key={tag.key}
              type="button"
              disabled={!loaded}
              onClick={() => toggleTag(tag.key)}
              aria-pressed={active}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50",
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-muted"
              )}
            >
              {tag.label}
            </button>
          );
        })}
      </div>
      <Textarea
        aria-label="Notatka dnia"
        placeholder="np. wyprawa w góry, spacer po zoo, gorączka"
        value={text}
        disabled={!loaded}
        maxLength={DAY_NOTE_MAX_LENGTH}
        onChange={(e) => {
          latest.current = { ...latest.current, text: e.target.value };
          setText(e.target.value);
          clearTimeout(textTimer.current);
          textTimer.current = setTimeout(flushText, TEXT_SAVE_DELAY_MS);
        }}
        onBlur={flushText}
        rows={2}
      />
      <p className="flex h-4 items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
        {!loaded ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" /> Wczytywanie...
          </>
        ) : status === "saving" ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" /> Zapisywanie...
          </>
        ) : text.trim() !== savedText.trim() ? null : status === "saved" ? (
          <>
            <Check className="h-3 w-3" /> Zapisano
          </>
        ) : null}
      </p>
    </div>
  );
}
