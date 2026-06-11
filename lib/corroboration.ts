// Pure multi-source corroboration scorer. Scans signals from the last 30 days
// and reports whether ≥ 3 distinct source types are present — a strong trust
// signal that the deal activity is real and not an artefact of one feed.

import type { Signal } from "@/lib/types";
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
const THRESHOLD = 3;

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
