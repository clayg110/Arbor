// Shared per-item processing for both ingestion pipelines: extract → resolve →
// persist, guarded by a circuit breaker (so a failing LLM doesn't get hammered)
// and backed by a dead-letter sink (so unprocessable items are never lost).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";
import { extractSignal } from "@/lib/extract-signal";
import { processSignal, type SignalMeta } from "@/lib/ingest/persist";
import { recordFailure } from "@/lib/ingest/deadletter";
import { withSpan } from "@/lib/trace";
import type { CircuitBreaker } from "@/lib/circuit";

type Svc = SupabaseClient<Database>;
type Counts = Record<string, number>;

function bump(counts: Counts, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

// Process one source item. Mutates `counts` (Outcome keys on success, `errors`
// on failure). Failures + circuit-open skips are dead-lettered for replay.
export async function processItem(
  svc: Svc,
  meta: SignalMeta,
  dealType: "carveout" | "private_asset",
  counts: Counts,
  breaker: CircuitBreaker
): Promise<void> {
  return withSpan("pipeline.process_item", "function", () =>
    processItemInner(svc, meta, dealType, counts, breaker)
  );
}

async function processItemInner(
  svc: Svc,
  meta: SignalMeta,
  dealType: "carveout" | "private_asset",
  counts: Counts,
  breaker: CircuitBreaker
): Promise<void> {
  if (breaker.isOpen()) {
    bump(counts, "errors");
    await recordFailure(svc, { ...meta, reason: "circuit_open" });
    return;
  }
  try {
    const ex = await extractSignal({
      rawText: meta.rawText,
      sourceType: meta.sourceType,
    });
    if (!ex) {
      breaker.recordFailure();
      bump(counts, "errors");
      await recordFailure(svc, { ...meta, reason: "extract_failed" });
      return;
    }
    breaker.recordSuccess();
    const r = await processSignal(svc, ex, meta, dealType);
    bump(counts, r.outcome);
  } catch (e) {
    breaker.recordFailure();
    bump(counts, "errors");
    await recordFailure(svc, {
      ...meta,
      reason: e instanceof Error ? e.message : "process_error",
    });
  }
}
