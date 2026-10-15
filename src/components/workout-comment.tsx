"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/markdown";
import { commentWorkoutNow } from "@/actions/coach";

/** AI coach's take on a gym session, generated on request (sets save as you go, so
 * there is no "session finished" moment to trigger it). */
export function WorkoutComment({
  workoutId,
  comment,
  commentedLabel,
  hasSets,
}: {
  workoutId: string;
  comment: string | null;
  commentedLabel: string | null;
  hasSets: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  const handleComment = () => {
    startTransition(async () => {
      const result = await commentWorkoutNow(workoutId);
      if ("error" in result) toast.error(result.error);
    });
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3 bg-muted/30 border-b border-border/50">
        <div className="flex items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base font-semibold">Komentarz trenera</CardTitle>
              {commentedLabel && (
                <p className="text-xs text-muted-foreground truncate">{commentedLabel}</p>
              )}
            </div>
          </div>
          {comment && (
            <Button
              variant="outline"
              size="icon"
              onClick={handleComment}
              disabled={isPending || !hasSets}
              aria-label="Odśwież komentarz"
              className="rounded-xl shrink-0"
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {comment ? (
          <Markdown className={isPending ? "opacity-50" : undefined}>{comment}</Markdown>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {hasSets
                ? "Po treningu poproś trenera o krótką ocenę sesji na tle poprzednich."
                : "Zapisz serie, a trener skomentuje sesję na tle poprzednich."}
            </p>
            <Button
              onClick={handleComment}
              disabled={isPending || !hasSets}
              className="w-full h-11 rounded-xl gap-2"
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {isPending ? "Trener analizuje…" : "Skomentuj trening"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
