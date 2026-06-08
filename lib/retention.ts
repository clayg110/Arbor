// Data-retention purge: bounds growth + enforces retention policy on append-only
// operational tables, and clears orphaned (unmatched) raw signals. Core
// intelligence (companies, deal_stage_history, referenced signals) is never
// touched. Pure cutoff calc is unit-tested; purgeExpired runs the deletes.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";

type Svc = SupabaseClient<Database>;

export function cutoffIso(days: number, now: number = Date.now()): string {
  return new Date(now - days * 86_400_000).toISOString();
}

export interface RetentionDays {
  deadletter: number; // signal_failures
  usage: number; // llm_usage
  runs: number; // pipeline_runs
  orphanSignals: number; // signals_raw with no matched company
}

export function retentionDays(): RetentionDays {
  const n = (v: string | undefined, d: number) => {
    const x = Number(v ?? d);
    return Number.isFinite(x) && x > 0 ? x : d;
  };
  return {
    deadletter: n(process.env.RETAIN_DEADLETTER_DAYS, 30),
    usage: n(process.env.RETAIN_USAGE_DAYS, 180),
    runs: n(process.env.RETAIN_RUNS_DAYS, 90),
    orphanSignals: n(process.env.RETAIN_ORPHAN_SIGNAL_DAYS, 365),
  };
}

async function del(
  builder: PromiseLike<{ count: number | null; error: unknown }>
): Promise<number> {
  const { count, error } = await builder;
  return error ? 0 : (count ?? 0);
}

// Delete expired rows; returns per-table counts. Never throws — a purge failure
// must not break the cron.
export async function purgeExpired(
  svc: Svc,
  now: number = Date.now()
): Promise<Record<string, number>> {
  const d = retentionDays();
  const out: Record<string, number> = {};
  try {
    out.signal_failures = await del(
      svc
        .from("signal_failures")
        .delete({ count: "exact" })
        .lt("created_at", cutoffIso(d.deadletter, now))
    );
    out.llm_usage = await del(
      svc
        .from("llm_usage")
        .delete({ count: "exact" })
        .lt("created_at", cutoffIso(d.usage, now))
    );
    out.pipeline_runs = await del(
      svc
        .from("pipeline_runs")
        .delete({ count: "exact" })
        .lt("ran_at", cutoffIso(d.runs, now))
    );
    // Orphaned raw signals (no matched company — e.g. found=false noise). Leaves
    // signals referenced by deal_stage_history untouched.
    out.signals_raw = await del(
      svc
        .from("signals_raw")
        .delete({ count: "exact" })
        .is("company_id", null)
        .lt("ingested_at", cutoffIso(d.orphanSignals, now))
    );
  } catch {
    // best-effort
  }
  return out;
}
