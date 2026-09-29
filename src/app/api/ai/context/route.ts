import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { checkBearer } from "@/lib/api-auth";
import {
  getCachedActivityTypes,
  getCachedDayNotesInRange,
  getCachedHealthMetricsInRange,
  getCachedLatestCoachReport,
  getCachedWorkoutsWithSetsInRange,
} from "@/lib/queries";
import { buildAIContext, contextWeekRanges, MAX_CONTEXT_WEEKS } from "@/lib/ai-context";
import { todayISO } from "@/lib/utils";

// Read side of the local AI coach contract: the last N weeks as JSON.
// GET /api/ai/context?user_email=…&weeks=4&today=YYYY-MM-DD, bearer AI_API_SECRET.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_WEEKS = 4;

export async function GET(request: Request) {
  const denied = checkBearer(request, "AI_API_SECRET");
  if (denied) return denied;

  const params = new URL(request.url).searchParams;
  const email = params.get("user_email");
  if (!email) {
    return NextResponse.json({ error: "Missing required param: user_email" }, { status: 400 });
  }

  const weeksParam = params.get("weeks");
  const weeks = weeksParam == null ? DEFAULT_WEEKS : Number(weeksParam);
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > MAX_CONTEXT_WEEKS) {
    return NextResponse.json(
      { error: `weeks must be an integer 1–${MAX_CONTEXT_WEEKS}` },
      { status: 400 }
    );
  }

  // The server runs in UTC; the caller knows the user's local "today".
  const todayParam = params.get("today");
  if (todayParam != null && !DATE_RE.test(todayParam)) {
    return NextResponse.json({ error: "today must be YYYY-MM-DD" }, { status: 400 });
  }
  const today = todayParam ?? todayISO();

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const ranges = contextWeekRanges(today, weeks);
  const start = ranges[0].start;
  const end = ranges[ranges.length - 1].end;

  const [activityTypes, workouts, healthMetrics, dayNotes, latestReport] = await Promise.all([
    getCachedActivityTypes(user.id),
    getCachedWorkoutsWithSetsInRange(user.id, start, end),
    getCachedHealthMetricsInRange(user.id, start, end),
    getCachedDayNotesInRange(user.id, start, end),
    getCachedLatestCoachReport(user.id),
  ]);

  return NextResponse.json(
    buildAIContext({
      today,
      weeks,
      activityTypes,
      workouts,
      healthMetrics,
      dayNotes,
      latestReport,
    })
  );
}
