import { NextResponse } from "next/server";
import { and, eq, gte, isNotNull, or, inArray } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { coachReports, users, workouts } from "@/lib/db/schema";
import { checkBearer } from "@/lib/api-auth";
import { generateWeeklyReport, lastClosedWeek } from "@/lib/ai/report";
import { todayISO } from "@/lib/utils";

// Vercel Cron, Mondays (vercel.json): a coach report for last week for every user who
// has a brief or trained recently. Vercel sends `Authorization: Bearer $CRON_SECRET`.
// Idempotent per week: a user who already has a report for that period is skipped,
// so a retry or a manual trigger never doubles it.

export async function GET(request: Request) {
  const denied = checkBearer(request, "CRON_SECRET");
  if (denied) return denied;

  const today = todayISO();
  const period = lastClosedWeek(today);

  const recent = db
    .selectDistinct({ userId: workouts.userId })
    .from(workouts)
    .where(gte(workouts.date, period.start));
  const candidates = await db
    .select({ id: users.id })
    .from(users)
    .where(or(isNotNull(users.coachBrief), inArray(users.id, recent)));

  const results: { userId: string; status: "created" | "exists" | "failed" }[] = [];
  for (const { id: userId } of candidates) {
    const existing = await db.query.coachReports.findFirst({
      where: and(eq(coachReports.userId, userId), eq(coachReports.periodStart, period.start)),
      columns: { id: true },
    });
    if (existing) {
      results.push({ userId, status: "exists" });
      continue;
    }
    try {
      await generateWeeklyReport(userId, today);
      results.push({ userId, status: "created" });
    } catch (error) {
      console.error(`weekly-report failed for ${userId}:`, error);
      results.push({ userId, status: "failed" });
    }
  }

  // Not updateTag: that one throws outside a Server Action, and this is a route.
  if (results.some((r) => r.status === "created")) revalidateTag("coach-reports", "max");
  return NextResponse.json({ period, results });
}
