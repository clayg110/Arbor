// Pure multi-source corroboration scorer. Scans signals from the last 30 days
// and reports whether ≥ 3 distinct source types are present — a strong trust
// signal that the deal activity is real and not an artefact of one feed.

import type { Signal, Confidence } from "@/lib/types";
import type { SourceType } from "@/lib/types";

export interface CorroborationResult {
  // True when ≥ 3 distinct source types appear in the 30-day window.
  corroborated: boolean;
  // How many distinct source types were found.
  sourceCount: number;
  // Which source types are represented.
  sources: SourceType[];
}

const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
export const CORROBORATION_THRESHOLD = 3;
const THRESHOLD = CORROBORATION_THRESHOLD;

// Distinct source-type count from a set of signal rows (nulls ignored).
export function distinctSourceCount(rows: { source_type: SourceType | null }[]): number {
  return new Set(rows.map((r) => r.source_type).filter(Boolean)).size;
}

// Auto-corroboration rule: when ≥ `threshold` independent source types back a
// company, its activity is trustworthy enough to promote to `high` confidence.
// Returns the confidence to write, or null when no bump applies (already high,
// or too few sources). Independent corroboration overrides a single low-quality
// signal, so this is checked even on a needs_review match.
export function corroboratedConfidence(
  current: Confidence,
  distinct: number,
  threshold = THRESHOLD
): Confidence | null {
  if (current === "high") return null;
  return distinct >= threshold ? "high" : null;
}

export function computeCorroboration(
  signals: Signal[],
  now = Date.now()
): CorroborationResult {
  const cutoff = now - WINDOW_MS;
  const recent = signals.filter((s) => new Date(s.ingestedAt).getTime() >= cutoff);
  const sources = [...new Set(recent.map((s) => s.sourceType))] as SourceType[];
  return {
    corroborated: sources.length >= THRESHOLD,
    sourceCount: sources.length,
    sources,
  };
}
