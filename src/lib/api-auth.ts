import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

// Machine clients (Apple Shortcuts, the local AI coach) have no NextAuth session,
// so their routes are protected by a static bearer token from an env var. Each
// client gets its own variable, so leaking one token doesn't open the other route.

function tokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Returns an error response to send, or null when the request is authorized. */
export function checkBearer(request: Request, envName: string): NextResponse | null {
  const secret = process.env[envName];
  if (!secret) {
    console.error(`${envName} is not set`);
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token || !tokenMatches(token, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
