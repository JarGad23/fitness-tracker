import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { users, healthMetrics } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { revalidateTag } from "next/cache";

// Called from Apple Shortcuts (no NextAuth session), so it is protected by a
// static bearer token in the WATCH_SYNC_SECRET env var. Runs on the default
// Node.js runtime (libSQL needs it); an explicit `runtime` export is not allowed
// with cacheComponents enabled.

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

  const {
    date,
    active_calories,
    resting_hr,
    sleep_hours,
    user_email,
    notes,
  } = (body ?? {}) as Record<string, unknown>;

  if (typeof date !== "string" || date.trim() === "" || typeof user_email !== "string") {
    return NextResponse.json(
      { error: "Missing required fields: date, user_email" },
      { status: 400 }
    );
  }

  const user = await db.query.users.findFirst({
    where: eq(users.email, user_email),
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const toInt = (v: unknown) =>
    typeof v === "number" ? Math.round(v) : v == null ? null : Number(v) || null;
  const toFloat = (v: unknown) =>
    typeof v === "number" ? v : v == null ? null : Number(v) || null;

  const metrics = {
    activeCalories: toInt(active_calories),
    restingHr: toInt(resting_hr),
    sleepHours: toFloat(sleep_hours),
    notes: typeof notes === "string" ? notes : null,
  };

  // Only overwrite columns the payload actually carried. Shortcuts often syncs a
  // partial payload (e.g. just calories one day, just resting HR another), and a
  // plain `set: metrics` would write null over previously-good values for every
  // field it omitted. Merge instead: update only the metrics that came in non-null.
  const updateSet: Partial<typeof metrics> = {};
  if (metrics.activeCalories != null) updateSet.activeCalories = metrics.activeCalories;
  if (metrics.restingHr != null) updateSet.restingHr = metrics.restingHr;
  if (metrics.sleepHours != null) updateSet.sleepHours = metrics.sleepHours;
  if (metrics.notes != null) updateSet.notes = metrics.notes;

  // Shortcuts can re-send the same day (manual re-run, retry, a later sync with
  // fuller data), so the latest payload for a day upserts onto the existing row
  // instead of piling up rows. id/createdAt stay as first written. If the payload
  // carried no metrics at all, keep the existing row untouched rather than error
  // on an empty update.
  const insert = db
    .insert(healthMetrics)
    .values({ id: uuid(), userId: user.id, date, ...metrics });

  await (Object.keys(updateSet).length > 0
    ? insert.onConflictDoUpdate({
        target: [healthMetrics.userId, healthMetrics.date],
        set: updateSet,
      })
    : insert.onConflictDoNothing());

  // Not updateTag: that one throws outside a Server Action, and this is a route.
  revalidateTag("health-metrics", "max");

  return NextResponse.json({ success: true });
}
