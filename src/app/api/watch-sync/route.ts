import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { users, healthMetrics } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { updateTag } from "next/cache";

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

  if (typeof date !== "string" || typeof user_email !== "string") {
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

  await db.insert(healthMetrics).values({
    id: uuid(),
    userId: user.id,
    date,
    activeCalories: toInt(active_calories),
    restingHr: toInt(resting_hr),
    sleepHours: toFloat(sleep_hours),
    notes: typeof notes === "string" ? notes : null,
  });

  updateTag("health-metrics");

  return NextResponse.json({ success: true });
}
