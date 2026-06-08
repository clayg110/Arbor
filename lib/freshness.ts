// Data-freshness SLA: a "live" intelligence platform that silently stops
// ingesting is worse than one that's visibly down. evaluateFreshness is the pure
// staleness calc (testable); checkFreshness reads the latest signal timestamp.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";

export interface Freshness {
  stale: boolean;
  lastSignalAt: string | null;
  ageHours: number | null;
  maxAgeHours: number;
}

export function evaluateFreshness(
  lastSignalAt: string | null,
  maxAgeHours: number,
  now: number = Date.now()
): Freshness {
  if (!lastSignalAt) {
    return { stale: true, lastSignalAt: null, ageHours: null, maxAgeHours };
  }
  const ageHours = (now - Date.parse(lastSignalAt)) / 3_600_000;
  return {
    stale: ageHours > maxAgeHours,
    lastSignalAt,
    ageHours: Math.round(ageHours * 100) / 100,
    maxAgeHours,
  };
}

export async function checkFreshness(
  svc: SupabaseClient<Database>,
  maxAgeHours: number
): Promise<Freshness> {
  const { data } = await svc
    .from("signals_raw")
    .select("ingested_at")
    .order("ingested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const last = (data as { ingested_at: string } | null)?.ingested_at ?? null;
  return evaluateFreshness(last, maxAgeHours);
}
