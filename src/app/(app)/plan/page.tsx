import { Suspense } from "react";
import Link from "next/link";
import { auth } from "@/lib/auth";
import {
  getCachedTrainingPlan,
  getCachedLastPlanDayId,
  getCachedLatestPlanRevision,
} from "@/lib/queries";
import { planRevisionView } from "@/lib/plan-revision-view";
import { PlanRevisionPanel } from "@/components/plan-revision-panel";
import { formatRepRange, nextPlanDay } from "@/lib/plan";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PlanChecklistItem } from "@/lib/db/schema";

const SECTIONS: { key: PlanChecklistItem["section"]; title: string }[] = [
  { key: "warmup", title: "Rozgrzewka (ok. 8 min)" },
  { key: "cardio", title: "Cardio po treningu" },
  { key: "home", title: "Domowy pakiet na bark" },
];

// Rendered on the server (UTC on Vercel), so the time zone is explicit.
const createdFormat = new Intl.DateTimeFormat("pl-PL", {
  timeZone: "Europe/Warsaw",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

async function PlanSection() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const [plan, lastPlanDayId, revision] = await Promise.all([
    getCachedTrainingPlan(userId),
    getCachedLastPlanDayId(userId),
    getCachedLatestPlanRevision(userId),
  ]);
  if (!plan) {
    return (
      <p className="text-sm text-muted-foreground">
        Nie masz jeszcze planu treningowego.
      </p>
    );
  }
  const next = nextPlanDay(plan.days, lastPlanDayId);

  return (
    <>
      <div>
        <h1 className="text-xl font-bold tracking-tight">{plan.name}</h1>
        <p className="text-sm text-muted-foreground">
          Rotacja {plan.days.map((d) => d.label).join(" → ")}
          {next && ` · następny: ${next.label}`}
        </p>
      </div>

      <PlanRevisionPanel
        revision={
          revision && revision.planId === plan.id
            ? planRevisionView(revision, plan, createdFormat.format(revision.createdAt))
            : null
        }
      />

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        {plan.days.map((day) => (
          <Card key={day.id} className="border-border/50 overflow-hidden">
            <CardHeader className="pb-2 border-b border-border/50 bg-muted/30">
              <CardTitle className="text-base font-semibold">
                {day.label} · {day.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ol className="divide-y divide-border/50">
                {day.exercises.map((e, i) => {
                  const prev = day.exercises[i - 1];
                  const inSuperset =
                    e.superset != null &&
                    (prev?.superset === e.superset || day.exercises[i + 1]?.superset === e.superset);
                  return (
                    <li key={e.id} className="px-4 py-3 space-y-0.5">
                      <div className="flex items-baseline gap-3">
                        <Link
                          href={`/cwiczenie/${e.exerciseId}`}
                          className="min-w-0 flex-1 font-medium hover:text-primary"
                        >
                          {e.exercise.name}
                        </Link>
                        <span className="shrink-0 text-sm font-semibold tabular-nums">
                          {e.sets} × {formatRepRange(e, e.exercise.unit)}
                        </span>
                      </div>
                      {inSuperset && (
                        <p className="text-xs font-semibold text-primary">
                          Superseria z {prev?.superset === e.superset ? "poprzednim" : "następnym"}
                        </p>
                      )}
                      {e.alternative && (
                        <p className="text-xs text-muted-foreground">Zamiennik: {e.alternative}</p>
                      )}
                      {e.tips && <p className="text-xs text-muted-foreground">{e.tips}</p>}
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        ))}

        {SECTIONS.map(({ key, title }) => {
          const items = plan.checklist.filter((c) => c.section === key);
          if (items.length === 0) return null;
          return (
            <Card key={key} className="border-border/50 overflow-hidden">
              <CardHeader className="pb-2 border-b border-border/50 bg-muted/30">
                <CardTitle className="text-base font-semibold">{title}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-border/50">
                  {items.map((item) => (
                    <li key={item.id} className="px-4 py-3">
                      <p className="font-medium">{item.title}</p>
                      {item.detail && (
                        <p className="text-sm text-muted-foreground">{item.detail}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}

        {plan.notes.map((note) => (
          <Card key={note.title} className="border-border/50 overflow-hidden">
            <CardHeader className="pb-2 border-b border-border/50 bg-muted/30">
              <CardTitle className="text-base font-semibold">{note.title}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-sm leading-relaxed">
              {note.body.split("\n\n").map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

function PlanSkeleton() {
  return (
    <>
      <div className="h-12 rounded-xl bg-muted/30 animate-pulse" />
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-80 rounded-xl bg-muted/30 animate-pulse" />
        ))}
      </div>
    </>
  );
}

export default function PlanPage() {
  return (
    <div className="p-4 lg:p-0 space-y-4">
      <Suspense fallback={<PlanSkeleton />}>
        <PlanSection />
      </Suspense>
    </div>
  );
}
