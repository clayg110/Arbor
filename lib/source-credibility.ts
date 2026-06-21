// Source-credibility weighting. Multi-source corroboration (lib/corroboration.ts)
// counts DISTINCT sources; this weights them by how trustworthy each source type
// is — a primary regulatory filing is worth more than a generic news blurb. The
// weighted "source strength" rewards both credibility and diversity, so one SEC
// filing outranks three reposts of the same rumour. Pure + unit-tested.

import type { SourceType } from "@/lib/types";

// Credibility weight per source type (0–1). Primary regulatory filings are the
// most trustworthy; aggregated news/RSS the least; manual is analyst-asserted.
export const SOURCE_CREDIBILITY: Record<SourceType, number> = {
  sec_filing: 1.0,
  hsr_filing: 1.0,
  earnings_transcript: 0.85,
  manual: 0.7,
  google_news: 0.5,
  rss_feed: 0.45,
};

const DEFAULT_CREDIBILITY = 0.4;

export function sourceCredibility(s: SourceType): number {
  return SOURCE_CREDIBILITY[s] ?? DEFAULT_CREDIBILITY;
}

export type CredibilityTier = "primary" | "corroborated" | "thin";

export interface SourceStrength {
  score: number; // 0–100 weighted source strength
  tier: CredibilityTier;
  distinctSources: number;
  topSource: SourceType | null; // the highest-credibility source present
}

export const PRIMARY_THRESHOLD = 85;
export const CORROBORATED_THRESHOLD = 55;
// Each additional distinct source contributes a fraction of its own credibility.
const DIVERSITY_FACTOR = 0.25;

export function tierFor(score: number): CredibilityTier {
  if (score >= PRIMARY_THRESHOLD) return "primary";
  if (score >= CORROBORATED_THRESHOLD) return "corroborated";
  return "thin";
}

// Weighted source strength: the best source's credibility plus a diminishing
// bonus for each additional distinct source. Capped at 100.
export function sourceStrength(sources: SourceType[]): SourceStrength {
  const distinct = [...new Set(sources)];
  if (distinct.length === 0) {
    return { score: 0, tier: "thin", distinctSources: 0, topSource: null };
  }
  const weights = distinct.map(sourceCredibility).sort((a, b) => b - a);
  const best = weights[0]!;
  const bonus = weights.slice(1).reduce((sum, w) => sum + w * DIVERSITY_FACTOR, 0);
  const score = Math.round(Math.min(1, best + bonus) * 100);

  let topSource = distinct[0]!;
  for (const s of distinct) {
    if (sourceCredibility(s) > sourceCredibility(topSource)) topSource = s;
  }

  return { score, tier: tierFor(score), distinctSources: distinct.length, topSource };
}

// Credibility-weighted "is this real?" check — true once the weighted strength
// clears the corroborated bar, so one primary OR several diverse sources count,
// not merely a raw count of weak feeds.
export function isCredibilityCorroborated(
  sources: SourceType[],
  threshold = CORROBORATED_THRESHOLD
): boolean {
  return sourceStrength(sources).score >= threshold;
}

export const CREDIBILITY_TIER_LABEL: Record<CredibilityTier, string> = {
  primary: "Primary source",
  corroborated: "Corroborated",
  thin: "Thin sourcing",
};

// AA-contrast dot colors (decorative dots only — never text on white).
export const CREDIBILITY_TIER_COLOR: Record<CredibilityTier, string> = {
  primary: "#157A5A",
  corroborated: "#8A5712",
  thin: "#5f5e57",
};
