// LLM spend guard. A monthly USD cap (env LLM_MONTHLY_BUDGET_USD) bounds
// on-demand spend (memo / Q&A / outreach) so a runaway loop or abuse can't run up
// an unbounded Anthropic bill. The math is pure + unit-tested; the lookup that
// sums this month's logged cost from llm_usage is a thin, fail-open I/O wrapper
// (a metering blip must not take a user-facing feature offline). No cap env set
// → no limit, fully dormant. Per-org caps are a future extension (llm_usage is
// currently global; would need org_id on the table).

import { createServiceClient, hasSupabaseEnv } from "@/lib/supabase/server";

// UTC "YYYY-MM" for the given date — the window spend accrues against.
export function monthKey(date: Date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

// First instant of the current UTC month, as an ISO string for a >= filter.
export function monthStartIso(date: Date = new Date()): string {
  return `${monthKey(date)}-01T00:00:00.000Z`;
}

// Parse the configured cap. Returns null (no cap) when unset, non-numeric, or ≤ 0.
export function parseBudgetUsd(
  raw: string | undefined = process.env.LLM_MONTHLY_BUDGET_USD
): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// True when spend is still under the cap. A null cap means no limit → always within.
export function isWithinBudget(spentUsd: number, capUsd: number | null): boolean {
  if (capUsd === null) return true;
  return spentUsd < capUsd;
}

// Dormant + fail-open check used to gate on-demand LLM calls. Returns true only
// when a cap is configured AND this month's logged spend has reached it.
export async function llmBudgetExceeded(): Promise<boolean> {
  const cap = parseBudgetUsd();
  if (cap === null) return false;
  if (!hasSupabaseEnv()) return false;
  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from("llm_usage")
      .select("cost_usd")
      .gte("created_at", monthStartIso());
    if (error || !data) return false;
    const spent = data.reduce(
      (sum, r) => sum + Number((r as { cost_usd: number }).cost_usd ?? 0),
      0
    );
    return !isWithinBudget(spent, cap);
  } catch {
    return false; // fail open — never block a feature on a metering error
  }
}
