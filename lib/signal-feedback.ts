// Analyst feedback loop: thumbs up/down on a signal captures human judgment on
// whether the extractor got it right. Aggregated, sustained feedback nudges the
// signal's confidence (and is the training data for tuning extraction later).
// Pure + tested so the nudge rule is auditable; the route persists the votes.

import type { Confidence } from "@/lib/types";

export type FeedbackVote = "up" | "down";

export interface FeedbackAggregate {
  up: number;
  down: number;
  net: number; // up − down
  total: number;
}

export function aggregateFeedback(votes: FeedbackVote[]): FeedbackAggregate {
  let up = 0;
  let down = 0;
  for (const v of votes) {
    if (v === "up") up += 1;
    else if (v === "down") down += 1;
  }
  return { up, down, net: up - down, total: up + down };
}

// Confidence ordered by transaction-likelihood (low → high).
const ORDER: Confidence[] = ["needs_review", "low", "medium", "high"];

// Net votes needed to move the signal's confidence one step.
export const PROMOTE_THRESHOLD = 2;
export const DEMOTE_THRESHOLD = 2;

// Nudge a base confidence by sustained net feedback — one step at most, so a
// couple of dissenting analysts can't swing it wildly. Strong net agreement
// promotes; strong net disagreement demotes toward review.
export function adjustedConfidence(base: Confidence, agg: FeedbackAggregate): Confidence {
  const idx = ORDER.indexOf(base);
  if (idx < 0) return base;
  if (agg.net >= PROMOTE_THRESHOLD) return ORDER[Math.min(ORDER.length - 1, idx + 1)]!;
  if (agg.net <= -DEMOTE_THRESHOLD) return ORDER[Math.max(0, idx - 1)]!;
  return base;
}

export function wasAdjusted(base: Confidence, agg: FeedbackAggregate): boolean {
  return adjustedConfidence(base, agg) !== base;
}

// Compact label for the net score, e.g. "+2" / "−1" / "" (when no votes).
export function netLabel(agg: FeedbackAggregate): string {
  if (agg.total === 0) return "";
  if (agg.net === 0) return "0";
  return agg.net > 0 ? `+${agg.net}` : `−${Math.abs(agg.net)}`;
}
