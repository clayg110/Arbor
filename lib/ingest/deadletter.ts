// Dead-letter sink for signals the pipeline couldn't process (extraction hard-
// failed, or the extraction circuit was open). Best-effort: recording a failure
// must never break the run. Rows are retained for inspection / manual replay.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";
import type { SourceType } from "@/lib/types";

export interface SignalFailure {
  sourceUrl: string;
  sourceType: SourceType;
  sourceName: string;
  docType: string;
  rawText: string;
  reason: string;
}

export async function recordFailure(
  svc: SupabaseClient<Database>,
  f: SignalFailure
): Promise<void> {
  try {
    await svc.from("signal_failures").insert({
      source_url: f.sourceUrl,
      source_type: f.sourceType,
      source_name: f.sourceName,
      doc_type: f.docType,
      raw_text: f.rawText.slice(0, 8000),
      reason: f.reason.slice(0, 500),
    });
  } catch {
    // dead-letter is best-effort
  }
}
