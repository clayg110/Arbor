import { NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/supabase/server";
import { captureException } from "@/lib/observability";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

// Per-client cached read response. `private` keeps it out of shared CDN caches
// (these payloads are scoped to the signed-in user); SWR lets the browser serve
// a slightly stale copy while revalidating. Use only for heavy, non-realtime
// aggregations (analytics / stats), never for the live feed.
export function cached<T>(data: T, seconds: number): NextResponse {
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": `private, max-age=${seconds}, stale-while-revalidate=${seconds * 5}`,
    },
  });
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// Routes are no-ops until backend env is set (app still runs in mock mode).
export function requireBackend(): NextResponse | null {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Backend not configured" }, { status: 503 });
  }
  return null;
}

// CSV query param → string[].
export function csv(v: string | null): string[] {
  return v
    ? v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
}

// Strip PostgREST filter-grammar control characters from user input that gets
// embedded in an .or()/ilike filter string. PostgREST uses "," to separate
// conditions and "()" to group/embed, so unsanitized input can break out of the
// intended filter (filter injection). Also drops the ilike wildcards (% *) so a
// caller can't widen the match, and caps length.
export function safeFilterValue(v: string, max = 80): string {
  return v
    .replace(/[,()%*\\":]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

// 500 helper: capture the real error server-side (structured log + Sentry),
// return a generic message so DB / internal details never reach the client.
export function serverError(e: unknown, message = "Internal server error"): NextResponse {
  captureException(e, { scope: "api" });
  return NextResponse.json({ error: message }, { status: 500 });
}

// 429 helper with a Retry-After hint (seconds until the window resets).
export function tooMany(resetMs = 0): NextResponse {
  const retry = resetMs ? Math.max(1, Math.ceil((resetMs - Date.now()) / 1000)) : 60;
  return NextResponse.json(
    { error: "Rate limit exceeded" },
    { status: 429, headers: { "Retry-After": String(retry) } }
  );
}
