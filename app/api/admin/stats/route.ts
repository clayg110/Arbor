import { createClient, createServiceClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend } from "@/lib/api/respond";
import { getSessionUser } from "@/lib/api/auth";
import type { PipelineLatestRow, SummaryMetricsRow } from "@/types/db";

// GET /api/admin/stats — admin-only. Live system stats + latest pipeline runs.
export async function GET() {
  const guard = requireBackend();
  if (guard) return guard;

  const supabase = createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);
  if (user.role !== "admin") return fail("Forbidden", 403);

  const svc = createServiceClient();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [companies, signals, llm, metrics, pipelines] = await Promise.all([
    svc.from("companies").select("id", { count: "exact", head: true }),
    svc.from("signals_raw").select("id", { count: "exact", head: true }).gte("ingested_at", weekAgo),
    svc.from("llm_usage").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
    svc.rpc("rpc_summary_metrics", {}),
    svc.from("v_pipeline_latest").select("*"),
  ]);

  const metricsRow = (metrics.data?.[0] as SummaryMetricsRow | undefined) ?? null;

  return ok({
    stats: {
      totalCompanies: companies.count ?? 0,
      signalsThisWeek: signals.count ?? 0,
      llmCallsThisWeek: llm.count ?? 0,
      avgConfidence: metricsRow ? Number(metricsRow.avg_confidence) : null,
    },
    pipelines: ((pipelines.data ?? []) as PipelineLatestRow[]).map((p) => ({
      pipeline: p.pipeline,
      ranAt: p.ran_at,
      records: p.created + p.updated,
      errors: p.errors,
      ok: p.ok,
    })),
  });
}
