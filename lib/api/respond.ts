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
