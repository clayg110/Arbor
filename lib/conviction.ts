// Conviction score: a 0–100 "likely to transact" signal per company, blending
// signal recency, signal volume + source corroboration, extraction confidence,
// and how close the deal sits to an actual transaction. Pure + unit-tested so the
// weighting is auditable and stable; fed by stored aggregates (live) or derived
// from the last-signal fields (mock / new companies). Tune WEIGHTS, not callers.

import type { Confidence, Stage } from "@/lib/types";

export type ConvictionBand = "hot" | "warm" | "cold";

export interface Conviction {
  score: number; // 0–100
  band: ConvictionBand;
}

export interface ConvictionInputs {
  lastSignalAgeDays: number; // 99999 when there is no signal
  confidence: Confidence;
  stage: Stage;
  signalCount30d?: number; // distinct signals in the last 30d (default: 1 if a signal exists)
  distinctSourceTypes?: number; // independent source types (default: 1 if a signal exists)
}

const CONFIDENCE_WEIGHT: Record<Confidence, number> = {
  high: 1,
  medium: 0.66,
  low: 0.33,
  needs_review: 0.15,
};

// Closeness to an actual transaction.
const STAGE_WEIGHT: Record<Stage, number> = {
  in_market: 1,
  monitor_for_exit: 0.5,
  on_hold: 0.25,
  pulled: 0,
};

// Sub-score weights (sum to 1).
const WEIGHTS = {
  recency: 0.3,
  volume: 0.2,
  diversity: 0.15,
  confidence: 0.2,
  stage: 0.15,
};

const NO_SIGNAL_AGE = 99999;

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function bandFor(score: number): ConvictionBand {
  if (score >= 67) return "hot";
  if (score >= 34) return "warm";
  return "cold";
}

export function computeConviction(i: ConvictionInputs): Conviction {
  const hasSignal = i.lastSignalAgeDays < NO_SIGNAL_AGE;
  const count = i.signalCount30d ?? (hasSignal ? 1 : 0);
  const sources = i.distinctSourceTypes ?? (hasSignal ? 1 : 0);

  const recency = clamp01(1 - i.lastSignalAgeDays / 30); // fresh ≤30d
  const volume = clamp01(count / 5); // saturates at 5 signals
  const diversity = clamp01(sources / 3); // saturates at 3 source types
  const confidence = CONFIDENCE_WEIGHT[i.confidence] ?? 0;
  const stage = STAGE_WEIGHT[i.stage] ?? 0;

  const weighted =
    WEIGHTS.recency * recency +
    WEIGHTS.volume * volume +
    WEIGHTS.diversity * diversity +
    WEIGHTS.confidence * confidence +
    WEIGHTS.stage * stage;

  let score = Math.round(clamp01(weighted) * 100);
  // A pulled process is a decision NOT to transact — floor it to cold regardless
  // of how fresh the surrounding chatter is.
  if (i.stage === "pulled") score = Math.min(score, 20);

  return { score, band: bandFor(score) };
}

export const CONVICTION_LABEL: Record<ConvictionBand, string> = {
  hot: "Hot",
  warm: "Warm",
  cold: "Cold",
};

// AA-contrast dot colors (used as decorative dots, never as text on white).
export const CONVICTION_COLOR: Record<ConvictionBand, string> = {
  hot: "#157A5A",
  warm: "#8A5712",
  cold: "#5f5e57",
};
