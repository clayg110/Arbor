import { NextResponse } from "next/server";
import { verifyTurnstile } from "@/lib/turnstile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/security/turnstile — verify a Cloudflare Turnstile token before a
// sensitive client action (signup / sign-in). Dormant: with no
// TURNSTILE_SECRET_KEY it returns ok:true so the app stays usable in mock mode.
export async function POST(request: Request) {
  let token: string | null = null;
  try {
    const body = (await request.json()) as { token?: unknown };
    if (typeof body.token === "string") token = body.token;
  } catch {
    /* empty / malformed body → token stays null (fail-closed when enforcing) */
  }

  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;

  const result = await verifyTurnstile(token, ip);
  return NextResponse.json(
    { ok: result.ok },
    { status: result.ok ? 200 : 403, headers: { "Cache-Control": "no-store" } }
  );
}
