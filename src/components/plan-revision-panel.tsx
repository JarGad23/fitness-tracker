"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowRight, Check, Loader2, Sparkles, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/markdown";
import {
  applyPlanChange,
  proposePlanRevision,
  rejectPlanChange,
  type ExerciseChoice,
} from "@/actions/plan-revisions";
import { MAX_REQUEST_LENGTH, type PlanChangeView, type PlanRevisionView } from "@/lib/plan-revision-view";
import { cn } from "@/lib/utils";

const TYPE_LABEL: Record<PlanChangeView["type"], string> = {
  update: "Zmiana",
  replace: "Zamiana",
  add: "Nowe",
  remove: "Usunięcie",
};

function ChangeCard({ revisionId, change }: { revisionId: string; change: PlanChangeView }) {
  const [isPending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<{ proposed: string; similarId: string; similarName: string } | null>(null);
  const pending = change.status === "pending";

  const apply = (choice?: ExerciseChoice) =>
    startTransition(async () => {
      const result = await applyPlanChange(revisionId, change.index, choice);
      if ("error" in result) toast.error(result.error);
      else if ("confirm" in result) setConfirm(result.confirm);
      else {
        setConfirm(null);
        toast.success("Plan zaktualizowany");
      }
    });
  const reject = () =>
    startTransition(async () => {
      try {
        await rejectPlanChange(revisionId, change.index);
      } catch {
        toast.error("Nie udało się odrzucić zmiany");
      }
    });

  return (
    <li className={cn("px-4 py-3 space-y-2", !pending && "opacity-60")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <p className="text-xs font-semibold text-primary">
            {TYPE_LABEL[change.type]}
            {change.dayLabel && ` · dzień ${change.dayLabel}`}
          </p>
          <p className="font-medium break-words">{change.title}</p>
          {(change.before || change.after) && (
            <p className="flex flex-wrap items-center gap-1.5 text-sm tabular-nums">
              {change.before && (
                <span className={cn(change.after && "text-muted-foreground line-through")}>
                  {change.before}
                </span>
              )}
              {change.before && change.after && (
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
              )}
              {change.after && <span className="font-semibold">{change.after}</span>}
            </p>
          )}
          {change.notes.map((n) => (
            <p key={n} className="text-xs text-muted-foreground">
              {n}
            </p>
          ))}
        </div>
        {!pending && (
          <span className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground">
            {change.status === "applied" ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
            {change.status === "applied" ? "Zastosowano" : "Odrzucono"}
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{change.reason}</p>

      {pending && confirm && (
        <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
          <p className="text-sm">
            Czy chodziło o <span className="font-semibold">{confirm.similarName}</span>?
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={isPending} onClick={() => apply({ useExerciseId: confirm.similarId })}>
              Tak, użyj „{confirm.similarName}”
            </Button>
            <Button size="sm" variant="outline" disabled={isPending} onClick={() => apply({ createNew: true })}>
              Nie, dodaj „{confirm.proposed}”
            </Button>
          </div>
        </div>
      )}

      {pending && !confirm && (
        <div className="flex gap-2">
          {change.stale ? (
            <p className="flex-1 text-xs text-muted-foreground self-center">
              Plan zmienił się od tej propozycji.
            </p>
          ) : (
            <Button size="sm" disabled={isPending} onClick={() => apply()} className="gap-1.5">
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Zastosuj
            </Button>
          )}
          <Button size="sm" variant="outline" disabled={isPending} onClick={reject} className="gap-1.5">
            <X className="w-3.5 h-3.5" />
            Odrzuć
          </Button>
        </div>
      )}
    </li>
  );
}

export function PlanRevisionPanel({ revision }: { revision: PlanRevisionView | null }) {
  const [isGenerating, startGenerating] = useTransition();
  const [request, setRequest] = useState("");

  const propose = () =>
    startGenerating(async () => {
      const result = await proposePlanRevision(request);
      if ("error" in result) toast.error(result.error);
      else setRequest("");
    });

  const open = revision?.changes.filter((c) => c.status === "pending").length ?? 0;

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/50 bg-muted/30">
        <div className="flex items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base font-semibold">Przegląd planu przez AI</CardTitle>
              <p className="text-xs text-muted-foreground truncate">
                {revision
                  ? `${revision.createdLabel} · ${open > 0 ? `${open} do decyzji` : "rozpatrzone"}`
                  : "Propozycje zmian na podstawie Twoich serii"}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={propose}
            disabled={isGenerating}
            className="rounded-xl gap-2 shrink-0"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span className="hidden sm:inline">{isGenerating ? "Analizuję…" : "Zaproponuj zmiany"}</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="px-4 pb-4 border-b border-border/50">
          <Textarea
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            maxLength={MAX_REQUEST_LENGTH}
            rows={2}
            disabled={isGenerating}
            aria-label="Czego chcesz w planie?"
            placeholder="Opcjonalnie: czego chcesz? Np. więcej nóg w dniu B"
            className="min-h-0"
          />
        </div>
        {isGenerating && (
          <p className="px-4 pt-4 text-sm text-muted-foreground">
            Trener przegląda serie z ostatnich tygodni — to może potrwać 1–2 minuty…
          </p>
        )}
        {revision ? (
          <>
            <Markdown className="p-4">{revision.summary}</Markdown>
            {revision.changes.length > 0 && (
              <ul className="divide-y divide-border/50 border-t border-border/50">
                {revision.changes.map((c) => (
                  <ChangeCard key={`${revision.id}-${c.index}`} revisionId={revision.id} change={c} />
                ))}
              </ul>
            )}
          </>
        ) : (
          !isGenerating && (
            <p className="p-4 text-sm text-muted-foreground">
              Trener przejrzy Twoje serie i notatki i zaproponuje zmiany w planie. Nic nie zmieni
              się bez Twojej zgody — każdą zmianę zatwierdzasz osobno.
            </p>
          )
        )}
      </CardContent>
    </Card>
  );
}
