"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { saveCoachBrief } from "@/actions/coach";
import { COACH_BRIEF_MAX_LENGTH } from "@/lib/ai/limits";

const SAVE_DELAY_MS = 1000;

/**
 * Free-text profile for the AI coach. Edited only here, so the server value is read
 * once on mount and never synced back mid-typing. Saves on a typing pause and on blur.
 */
export function CoachBriefEditor({ brief }: { brief: string | null }) {
  const [text, setText] = useState(brief ?? "");
  const [savedText, setSavedText] = useState(brief ?? "");
  const [saving, setSaving] = useState(0);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const latest = useRef(text);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const flush = () => {
    clearTimeout(timer.current);
    const next = latest.current;
    setSaving((n) => n + 1);
    queue.current = queue.current
      .then(() => saveCoachBrief(next))
      .then(() => {
        setSavedText(next);
      })
      .catch(() => {
        toast.error("Nie udało się zapisać briefu");
      })
      .finally(() => setSaving((n) => n - 1));
  };

  const dirty = text.trim() !== savedText.trim();

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardHeader className="border-b border-border/50 bg-muted/30">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-muted-foreground" />
          Brief trenera AI
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-2">
        <p className="text-sm text-muted-foreground">
          Twój profil dla AI: cele, staż, kontuzje, sprzęt, preferencje. Trafia do każdego
          raportu, komentarza i rozmowy z trenerem.
        </p>
        <Textarea
          aria-label="Brief trenera"
          placeholder="np. 180 cm, ~86 kg, siłownia od 4 lat. Cel: siła i redukcja. Prawy bark niestabilny przy wyciskaniu nad głowę…"
          value={text}
          maxLength={COACH_BRIEF_MAX_LENGTH}
          onChange={(e) => {
            latest.current = e.target.value;
            setText(e.target.value);
            clearTimeout(timer.current);
            timer.current = setTimeout(flush, SAVE_DELAY_MS);
          }}
          onBlur={() => {
            if (latest.current.trim() !== savedText.trim()) flush();
          }}
          rows={10}
          className="max-h-[60vh] text-sm"
        />
        <p
          className="flex h-4 items-center justify-between gap-1.5 text-xs text-muted-foreground"
          aria-live="polite"
        >
          <span className="flex items-center gap-1.5">
            {saving > 0 ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" /> Zapisywanie...
              </>
            ) : !dirty && savedText ? (
              <>
                <Check className="h-3 w-3" /> Zapisano
              </>
            ) : null}
          </span>
          <span>
            {text.length.toLocaleString("pl-PL")} / {COACH_BRIEF_MAX_LENGTH.toLocaleString("pl-PL")}
          </span>
        </p>
      </CardContent>
    </Card>
  );
}
