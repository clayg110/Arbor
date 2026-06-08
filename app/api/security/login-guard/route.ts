import { NextResponse } from "next/server";
import { checkLockout, recordFailure, clearFailures } from "@/lib/lockout";
import { clientIp } from "@/lib/redis/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

// POST /api/security/login-guard — brute-force lockout coordination for the
// client login flow. `action`: "check" (before sign-in), "fail" (after a bad
// password), "reset" (after success). IP is derived server-side, never trusted
// from the body. Dormant: with no Upstash env, lockout is unconfigured and every
// action reports unlocked, so the app stays usable in mock mode.
export async function POST(request: Request) {
  let action = "check";
  let email = "";
  try {
    const body = (await request.json()) as { action?: unknown; email?: unknown };
    if (typeof body.action === "string") action = body.action;
    if (typeof body.email === "string") email = body.email;
  } catch {
    /* malformed body → defaults (check, empty email) */
  }

  const ip = clientIp(request);

  if (action === "fail") {
    const s = await recordFailure(email, ip);
    return NextResponse.json(
      { locked: s.locked, retryAfter: s.retryAfter },
      { headers: NO_STORE }
    );
  }

  if (action === "reset") {
    await clearFailures(email, ip);
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  }

  const s = await checkLockout(email, ip);
  return NextResponse.json(
    { locked: s.locked, retryAfter: s.retryAfter },
    { status: s.locked ? 429 : 200, headers: NO_STORE }
  );
}
