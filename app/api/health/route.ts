import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/health — liveness + readiness. Always 200 while the server is up.
// `checks` reports which integrations are configured (env present). `?deep=1`
// additionally pings the database via the service role.
export async function GET(request: Request) {
  const checks = {
    supabase:
      !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
      !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    redis: !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN,
    sentry: !!process.env.SENTRY_DSN,
    turnstile: !!process.env.TURNSTILE_SECRET_KEY,
  };

  let db: "skip" | "ok" | "error" = "skip";
  const deep = new URL(request.url).searchParams.get("deep") === "1";
  if (deep && checks.supabase && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { createServiceClient } = await import("@/lib/supabase/server");
      const { error } = await createServiceClient()
        .from("companies")
        .select("id")
        .limit(1);
      db = error ? "error" : "ok";
    } catch {
      db = "error";
    }
  }

  return NextResponse.json(
    { status: "ok", time: new Date().toISOString(), checks, db },
    { headers: { "Cache-Control": "no-store" } }
  );
}
