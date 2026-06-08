import { createHash } from "crypto";

// Deterministic idempotency key for an ingested signal. Same source URL + text
// always hashes the same, so re-running a pipeline (or overlapping cron windows)
// can't insert the row twice. Text is capped so trivial trailing differences in
// huge documents don't defeat dedupe while keeping the key cheap.
export function dedupeKey(sourceUrl: string, rawText: string): string {
  return createHash("sha256")
    .update(`${sourceUrl}\n${(rawText ?? "").slice(0, 2000)}`)
    .digest("hex");
}
