import { Suspense } from "react";
import { getCachedActivityTypes, getCachedCoachBrief } from "@/lib/queries";
import { auth } from "@/lib/auth";
import { SettingsContent } from "@/components/settings-content";
import { CoachBriefEditor } from "@/components/coach-brief-editor";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

async function SettingsData() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const [activityTypes, coachBrief] = await Promise.all([
    getCachedActivityTypes(userId),
    getCachedCoachBrief(userId),
  ]);
  return (
    <SettingsContent
      activityTypes={activityTypes}
      coachBriefCard={<CoachBriefEditor brief={coachBrief} />}
    />
  );
}

function SettingsSkeleton() {
  return (
    <div className="p-4 lg:p-0 space-y-4">
      {[0, 1, 2, 3].map((i) => (
        <Card key={i} className="border-border/50 animate-pulse">
          <CardHeader className="h-12 bg-muted/30" />
          <CardContent className="h-16" />
        </Card>
      ))}
    </div>
  );
}

export default function UstawieniaPage() {
  return (
    <Suspense fallback={<SettingsSkeleton />}>
      <SettingsData />
    </Suspense>
  );
}
