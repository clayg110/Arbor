// Enrich-on-add: when an analyst adds a company by hand, kick off an immediate
// targeted web search for it instead of waiting for the next universe-scan cron.
// Found items feed the same extract → resolve → persist path as the pipelines,
// so a real signal surfaces on the new company within seconds of adding it.
//
// I/O orchestration (like lib/ingest/universe.ts) — no-op without Google CSE
// env. Called from POST /api/companies via `after()` so it runs post-response
// and never delays the add.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";
import { fetchCompanyWebSignals, fetchDivestitureSignals, hasGoogleEnv } from "./google";
import { processItem } from "./pipeline";
import { CircuitBreaker } from "@/lib/circuit";
import type { Outcome } from "./persist";
import type { DealType } from "@/lib/types";

export type EnrichCounts = Record<Outcome | "errors", number> & { fetched: number };

export interface EnrichResult extends EnrichCounts {
  searched: boolean; // false when dormant (no Google env)
}

const ZERO: EnrichCounts = {
  fetched: 0,
  skipped: 0,
  matched_nochange: 0,
  updated: 0,
  flagged: 0,
  created: 0,
  errors: 0,
};

// Run a one-off enrichment search for a freshly-added company. Carve-outs look
// for divestiture language; private-asset deals look for sale-process language.
export async function enrichCompanyOnAdd(
  svc: SupabaseClient<Database>,
  name: string,
  dealType: DealType,
  limit = 3
): Promise<EnrichResult> {
  if (!hasGoogleEnv()) return { searched: false, ...ZERO };

  const signals =
    dealType === "private_asset"
      ? await fetchCompanyWebSignals(name, limit)
      : await fetchDivestitureSignals(name, limit);

  const counts: EnrichCounts = { ...ZERO, fetched: signals.length };
  const breaker = new CircuitBreaker();

  for (const s of signals) {
    await processItem(
      svc,
      {
        sourceType: "google_news",
        sourceName: s.sourceName,
        docType: s.docType,
        sourceUrl: s.sourceUrl,
        rawText: s.rawText,
      },
      dealType,
      counts,
      breaker
    );
  }

  return { searched: true, ...counts };
}
