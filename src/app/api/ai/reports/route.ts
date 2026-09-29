import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { activityTypes, coachReports, users } from "@/lib/db/schema";
import { checkBearer } from "@/lib/api-auth";
import { normalizeTargets, type ParsedTarget } from "@/lib/ai-sync";

// Write side of the local AI coach contract. The coach posts a Markdown report and,
// optionally, proposed weekly targets. Targets are only stored — the user applies
// them on /ai-coach. POST /api/ai/reports, bearer AI_API_SECRET.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_REPORT_LENGTH = 20_000;
const MAX_MODEL_LENGTH = 200;

const badRequest = (error: string, status = 400) => NextResponse.json({ error }, { status });

const optionalDate = (value: unknown) =>
  value == null ? null : typeof value === "string" && DATE_RE.test(value) ? value : undefined;

export async function POST(request: Request) {
  const denied = checkBearer(request, "AI_API_SECRET");
  if (denied) return denied;

  let payload: Record<string, unknown>;
  try {
    payload = ((await request.json()) ?? {}) as Record<string, unknown>;
  } catch {
    return badRequest("Invalid JSON");
  }

  const { user_email, report, model, targets } = payload;
  if (typeof user_email !== "string") return badRequest("Missing required field: user_email");
  if (typeof report !== "string" || report.trim() === "") {
    return badRequest("Missing required field: report");
  }
  if (report.length > MAX_REPORT_LENGTH) {
    return badRequest(`report is longer than ${MAX_REPORT_LENGTH} characters`);
  }
  if (model != null && (typeof model !== "string" || model.length > MAX_MODEL_LENGTH)) {
    return badRequest(`model must be a string up to ${MAX_MODEL_LENGTH} characters`);
  }
  const periodStart = optionalDate(payload.period_start);
  const periodEnd = optionalDate(payload.period_end);
  if (periodStart === undefined || periodEnd === undefined) {
    return badRequest("period_start / period_end must be YYYY-MM-DD");
  }

  const user = await db.query.users.findFirst({ where: eq(users.email, user_email) });
  if (!user) return badRequest("User not found", 404);

  // Unlike the paste flow, a machine client gets every problem back so it can retry:
  // an invalid entry or an activity name the user doesn't have is rejected, not skipped.
  let parsedTargets: ParsedTarget[] | null = null;
  if (targets != null) {
    const invalid = "Every target needs a name and a positive integer target_per_week";
    if (!Array.isArray(targets)) return badRequest("targets must be an array", 422);
    try {
      parsedTargets = normalizeTargets(targets);
    } catch {
      return badRequest(invalid, 422);
    }
    if (parsedTargets.length !== targets.length) return badRequest(invalid, 422);

    const userTypes = await db.query.activityTypes.findMany({
      where: eq(activityTypes.userId, user.id),
    });
    const known = new Map(userTypes.map((t) => [t.name.trim().toLowerCase(), t.name]));
    const unknown = parsedTargets
      .map((t) => t.name)
      .filter((name) => !known.has(name.toLowerCase()));
    if (unknown.length > 0) {
      return NextResponse.json(
        {
          error: "Unknown activity names — use the names from /api/ai/context",
          unknown,
          known: userTypes.map((t) => t.name),
        },
        { status: 422 }
      );
    }
    // Store the user's spelling ("siłownia" → "Siłownia") for display.
    parsedTargets = parsedTargets.map((t) => ({ ...t, name: known.get(t.name.toLowerCase())! }));
  }

  const id = uuid();
  await db.insert(coachReports).values({
    id,
    userId: user.id,
    body: report.trim(),
    model: typeof model === "string" && model.trim() ? model.trim() : null,
    periodStart,
    periodEnd,
    targets: parsedTargets,
  });
  // Not updateTag: that one throws outside a Server Action, and this is a route.
  revalidateTag("coach-reports", "max");

  return NextResponse.json({ success: true, id }, { status: 201 });
}
