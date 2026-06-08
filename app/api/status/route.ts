import { NextResponse } from "next/server";
import { hasSupabaseEnv, createServiceClient } from "@/lib/supabase/server";
import { checkFreshness, type Freshness } from "@/lib/freshness";
import { computeStatus } from "@/lib/status";
import type { PipelineLatestRow } from "@/types/db";

export const dynamic = "force-dynamic";

interface PipelineStatus {
  pipeline: string;
  ranAt: string;
  errors: number;
  ok: boolean;
}

// GET /api/status — public, ops-safe system status for the /status page. Exposes
// only configuration booleans, a DB liveness flag, data freshness, and pipeline
// run summaries (no customer data). Public by design: a status page must be
// reachable even when auth/Supabase is down. Dormant: with no backend it reports
// mock mode rather than erroring.
export async function GET() {
  const checks = {
    supabase:
      !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
      !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    redis: !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN,
    sentry: !!process.env.SENTRY_DSN,
    turnstile: !!process.env.TURNSTILE_SECRET_KEY,
  };
  const time = new Date().toISOString();

  const live = hasSupabaseEnv() && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!live) {
    return NextResponse.json(
      { status: "mock", mode: "mock", checks, time },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const svc = createServiceClient();
  const maxAge = Number(process.env.FRESHNESS_MAX_HOURS ?? 24);

  let db: "ok" | "error" = "ok";
  let freshness: Freshness | null = null;
  let pipelines: PipelineStatus[] = [];
  try {
    const [fresh, pl] = await Promise.all([
      checkFreshness(svc, maxAge),
      svc.from("v_pipeline_latest").select("*"),
    ]);
    if (pl.error) throw pl.error;
    freshness = fresh;
    pipelines = ((pl.data ?? []) as PipelineLatestRow[]).map((p) => ({
      pipeline: p.pipeline,
      ranAt: p.ran_at,
      errors: p.errors,
      ok: p.ok,
    }));
  } catch {
    db = "error";
  }

  const status = computeStatus({
    mode: "live",
    db,
    freshnessStale: freshness?.stale,
    pipelines,
  });

  return NextResponse.json(
    { status, mode: "live", checks, db, freshness, pipelines, time },
    { headers: { "Cache-Control": "no-store" } }
  );
}
