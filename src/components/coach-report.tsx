"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { applyReportTargets } from "@/actions/ai-sync";
import { cn } from "@/lib/utils";

export type CoachReportView = {
  id: string;
  body: string;
  model: string | null;
  createdLabel: string;
  periodLabel: string | null;
  applied: boolean;
  targets: { name: string; current: number | null; proposed: number }[];
};

export function CoachReport({ report }: { report: CoachReportView | null }) {
  const [isPending, startTransition] = useTransition();

  const header = (subtitle: string) => (
    <CardHeader className="pb-3 bg-muted/30 border-b border-border/50">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0">
          <CardTitle className="text-base font-semibold">Raport lokalnego trenera</CardTitle>
          <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
        </div>
      </div>
    </CardHeader>
  );

  if (!report) {
    return (
      <Card className="border-border/50">
        {header("Brak raportu")}
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">
            Lokalny model nie wysłał jeszcze raportu. Pojawi się tutaj po wywołaniu{" "}
            <code className="text-xs">POST /api/ai/reports</code>.
          </p>
        </CardContent>
      </Card>
    );
  }

  const changes = report.targets.filter((t) => t.current !== t.proposed);

  const handleApply = () => {
    startTransition(async () => {
      const result = await applyReportTargets(report.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      if (result.skipped.length > 0) {
        toast.warning(`Pominięto nieznane aktywności: ${result.skipped.join(", ")}`);
      }
      toast.success(
        result.updated.length > 0
          ? `Zaktualizowano cele: ${result.updated.join(", ")}`
          : "Cele były już aktualne"
      );
    });
  };

  const subtitle = [report.createdLabel, report.model, report.periodLabel]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card className="border-border/50">
      {header(subtitle)}
      <CardContent className="pt-4 space-y-4">
        <div className="max-h-96 overflow-auto rounded-xl border border-border bg-muted/30 p-4 text-sm whitespace-pre-wrap break-words">
          {report.body}
        </div>

        {report.targets.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Proponowane cele tygodniowe</p>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {report.targets.map((t) => (
                <li
                  key={t.name}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                >
                  <span className="min-w-0 truncate">{t.name}</span>
                  <span className="flex items-center gap-2 tabular-nums shrink-0">
                    <span className="text-muted-foreground">{t.current ?? "—"}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                    <span
                      className={cn(
                        "font-semibold",
                        t.current !== t.proposed ? "text-primary" : "text-muted-foreground"
                      )}
                    >
                      {t.proposed}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <Button
              onClick={handleApply}
              disabled={isPending || report.applied || changes.length === 0}
              className="w-full h-11 rounded-xl gap-2"
            >
              {report.applied && <Check className="w-4 h-4" />}
              {report.applied
                ? "Cele zastosowane"
                : changes.length === 0
                  ? "Cele są już aktualne"
                  : isPending
                    ? "Zapisywanie..."
                    : "Zastosuj cele"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
