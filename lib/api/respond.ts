import { NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/supabase/server";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
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
  return v ? v.split(",").map((s) => s.trim()).filter(Boolean) : [];
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

// 500 helper: log the real error server-side, return a generic message so DB /
// internal details never reach the client (info disclosure).
export function serverError(e: unknown, message = "Internal server error"): NextResponse {
  console.error("[api]", e);
  return NextResponse.json({ error: message }, { status: 500 });
}
