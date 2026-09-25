import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { users, healthMetrics, activityTypes, workouts } from "@/lib/db/schema";
import { and, eq, gte, inArray, isNotNull, lte } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { revalidateTag } from "next/cache";
import {
  detectWorkouts,
  parseHealthPayload,
  type DayMetrics,
  type HealthKind,
} from "@/lib/health-sync";

// Called from Apple Shortcuts (no NextAuth session), so it is protected by a
// static bearer token in the WATCH_SYNC_SECRET env var. Runs on the default
// Node.js runtime (libSQL needs it); an explicit `runtime` export is not allowed
// with cacheComponents enabled.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Shortcuts re-sends days (the v2 shortcut sends a whole week every run), so a day
// upserts onto its (user_id, date) row. Only non-null metrics overwrite: a partial
// payload must not erase values stored earlier. id/createdAt stay as first written.
type DayUpsert = { date: string } & Partial<Omit<DayMetrics, "date">> & {
  notes?: string | null;
};

function upsertDay(userId: string, day: DayUpsert) {
  const { date, ...metrics } = day;
  const updateSet = Object.fromEntries(
    Object.entries(metrics).filter(([, v]) => v != null)
  );
  const insert = db
    .insert(healthMetrics)
    .values({ id: uuid(), userId, date, ...metrics });

  return Object.keys(updateSet).length > 0
    ? insert.onConflictDoUpdate({
        target: [healthMetrics.userId, healthMetrics.date],
        set: updateSet,
      })
    : insert.onConflictDoNothing();
}

// Watch-detected workouts to create for these days. Must run BEFORE the metrics
// upsert: detection compares against the values stored so far. Skips kinds the
// user has no activity for, and days that already have a workout of that activity
// (logged by hand, or created by an earlier sync).
async function planWatchWorkouts(userId: string, days: DayMetrics[]) {
  if (days.length === 0) return [];
  const from = days[0].date;
  const to = days[days.length - 1].date;

  const previousRows = await db.query.healthMetrics.findMany({
    where: and(
      eq(healthMetrics.userId, userId),
      gte(healthMetrics.date, from),
      lte(healthMetrics.date, to)
    ),
  });
  const detected = detectWorkouts(days, new Map(previousRows.map((r) => [r.date, r])));
  if (detected.length === 0) return [];

  const linked = await db.query.activityTypes.findMany({
    where: and(eq(activityTypes.userId, userId), isNotNull(activityTypes.healthKind)),
  });
  const byKind = new Map(linked.map((t) => [t.healthKind as HealthKind, t]));

  const existing = await db.query.workouts.findMany({
    where: and(
      eq(workouts.userId, userId),
      gte(workouts.date, from),
      lte(workouts.date, to),
      inArray(workouts.activityTypeId, linked.map((t) => t.id))
    ),
  });
  const taken = new Set(existing.map((w) => `${w.date}|${w.activityTypeId}`));

  return detected.flatMap((d) => {
    const type = byKind.get(d.kind);
    if (!type || taken.has(`${d.date}|${type.id}`)) return [];
    taken.add(`${d.date}|${type.id}`);
    return [{ date: d.date, activityTypeId: type.id, activity: type.name, note: d.note }];
  });
}

function tokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const secret = process.env.WATCH_SYNC_SECRET;
  if (!secret) {
    console.error("WATCH_SYNC_SECRET is not set");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token || !tokenMatches(token, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const payload = (body ?? {}) as Record<string, unknown>;
  // Local debugging of the shortcut: dump exactly what the phone sent.
  if (process.env.WATCH_SYNC_DEBUG === "1") {
    console.log("[watch-sync] payload", JSON.stringify(payload, null, 2));
  }
  const { user_email } = payload;
  if (typeof user_email !== "string") {
    return NextResponse.json({ error: "Missing required field: user_email" }, { status: 400 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.email, user_email),
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // `?dry=1` parses and reports without writing, for debugging from the shortcut.
  const dryRun = new URL(request.url).searchParams.get("dry") === "1";

  // v2 ("Watch Sync v2" shortcut): a week of raw lines, aggregated server-side.
  if (payload.version === 2) {
    // The server runs in UTC; the phone knows the user's local "today".
    const today =
      typeof payload.today === "string" && DATE_RE.test(payload.today)
        ? payload.today
        : new Date().toISOString().slice(0, 10);
    const parsed = parseHealthPayload(payload, today);
    const created = await planWatchWorkouts(user.id, parsed.days);

    if (!dryRun && parsed.days.length > 0) {
      const [first, ...rest] = [
        ...parsed.days.map((day) => upsertDay(user.id, day)),
        ...created.map((w) =>
          db.insert(workouts).values({
            id: uuid(),
            userId: user.id,
            activityTypeId: w.activityTypeId,
            date: w.date,
            notes: w.note,
            source: "watch",
          })
        ),
      ];
      await db.batch([first, ...rest]);
      revalidateTag("health-metrics", "max");
      if (created.length > 0) revalidateTag("workouts", "max");
    }

    return NextResponse.json({
      success: true,
      dryRun,
      saved: parsed.days,
      workouts: created.map(({ date, activity, note }) => ({ date, activity, note })),
      sleepLabels: parsed.sleepLabels,
      ignoredLines: parsed.ignoredLines,
    });
  }

  // v1 (original shortcut): a single day with pre-aggregated values.
  const { date, active_calories, resting_hr, sleep_hours, notes } = payload;
  if (typeof date !== "string" || date.trim() === "") {
    return NextResponse.json({ error: "Missing required field: date" }, { status: 400 });
  }

  // Non-positive means "no data" (e.g. a night without the watch sends sleep 0).
  const toNumber = (v: unknown) => {
    const n = typeof v === "number" ? v : v == null ? NaN : Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const kcal = toNumber(active_calories);
  const hr = toNumber(resting_hr);

  const day = {
    date,
    activeCalories: kcal != null ? Math.round(kcal) : null,
    restingHr: hr != null ? Math.round(hr) : null,
    sleepHours: toNumber(sleep_hours),
    notes: typeof notes === "string" ? notes : null,
  };

  if (!dryRun) {
    await upsertDay(user.id, day);
    // Not updateTag: that one throws outside a Server Action, and this is a route.
    revalidateTag("health-metrics", "max");
  }

  return NextResponse.json({ success: true });
}
