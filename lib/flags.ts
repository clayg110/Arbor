// Feature flags / kill switches. Default-ON: a feature is disabled only by an
// explicit feature_flags row with enabled=false. Missing table, missing row, or
// no backend all resolve to ON, so callers stay safe before migration 0042 is
// applied. Resolution (per-org override beats the global default) is pure +
// unit-tested; the async lookup is a thin dormant-safe I/O wrapper.

import { createServiceClient, hasSupabaseEnv } from "@/lib/supabase/server";

// Known flag keys. Kept as a union so callers can't typo a key. Each names a
// feature whose row, when enabled=false, switches it off without a redeploy.
export type FeatureKey =
  | "integration.crm" // CRM push (Affinity)
  | "integration.enrich" // enrich-on-add web search
  | "integration.hsr" // HSR/FTC regulatory ingest
  | "integration.calendar" // ICS calendar feed
  | "ingest.enabled" // master switch for ingestion crons
  | "llm.enabled"; // master switch for all LLM calls

export interface FlagRow {
  key: string;
  org_id: string | null;
  enabled: boolean;
}

// Pure resolver: given the flag rows for a key, decide enabled for an org.
// A row scoped to the org wins; otherwise the global (org_id NULL) row; absent
// both, the feature defaults ON.
export function resolveFlag(
  rows: FlagRow[],
  key: FeatureKey,
  orgId?: string | null
): boolean {
  const forKey = rows.filter((r) => r.key === key);
  if (forKey.length === 0) return true;
  const orgRow = orgId ? forKey.find((r) => r.org_id === orgId) : undefined;
  if (orgRow) return orgRow.enabled;
  const globalRow = forKey.find((r) => r.org_id === null);
  return globalRow ? globalRow.enabled : true;
}

// Async lookup. Any failure (no backend, missing table) → ON, never throws.
export async function isFeatureEnabled(
  key: FeatureKey,
  orgId?: string | null
): Promise<boolean> {
  if (!hasSupabaseEnv()) return true;
  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from("feature_flags")
      .select("key, org_id, enabled")
      .eq("key", key);
    if (error || !data) return true;
    return resolveFlag(data as FlagRow[], key, orgId);
  } catch {
    return true;
  }
}
