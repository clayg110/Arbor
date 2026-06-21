// Outcome-calibrated probability-to-close. Conviction (lib/conviction.ts) scores
// how "live" a deal looks; this turns that score into an empirical %-to-close by
// learning, per conviction band, how often comparable resolved deals actually
// closed. Small samples are Bayesian-smoothed toward a sensible prior so a band
// with two data points doesn't swing to 0% or 100%. Pure + unit-tested; feed it
// real resolved-deal samples (live) or the bundled history (demo). The band rate
// answers "deals that looked this strong closed N% of the time."

import { bandFor, type ConvictionBand } from "@/lib/conviction";

export interface OutcomeSample {
  convictionScore: number; // 0–100 the deal carried while live
  won: boolean; // closed = true; withdrawn / pulled = false
}

export interface BandCalibration {
  band: ConvictionBand;
  resolved: number; // sample size
  won: number;
  empiricalRate: number; // won/resolved as 0–100 (0 when no samples)
  smoothedRate: number; // Bayesian-smoothed toward the prior, 0–100
}

export interface CalibrationModel {
  bands: Record<ConvictionBand, BandCalibration>;
  totalResolved: number;
}

export interface CloseProbability {
  pct: number; // 0–100 estimated probability the deal closes
  band: ConvictionBand;
  sampleSize: number; // resolved comparables behind the estimate
  basis: "empirical" | "blended" | "prior";
}

// Prior close rate per band before any data — also the mean the smoother pulls
// small samples toward. Grounded in the usual shape: stronger signal → closes more.
const PRIOR: Record<ConvictionBand, number> = {
  hot: 0.58,
  warm: 0.34,
  cold: 0.12,
};

// Pseudo-count weight of the prior. With K=6, a band needs ~6 real outcomes
// before the empirical rate outweighs the prior.
const K = 6;
// Below this many samples we flag the estimate as leaning on the prior.
const EMPIRICAL_MIN = 8;

const BANDS: ConvictionBand[] = ["hot", "warm", "cold"];

function pct(n: number): number {
  return Math.round(n * 100);
}

export function buildCalibration(samples: OutcomeSample[]): CalibrationModel {
  const tally: Record<ConvictionBand, { won: number; resolved: number }> = {
    hot: { won: 0, resolved: 0 },
    warm: { won: 0, resolved: 0 },
    cold: { won: 0, resolved: 0 },
  };

  for (const s of samples) {
    const band = bandFor(s.convictionScore);
    tally[band].resolved += 1;
    if (s.won) tally[band].won += 1;
  }

  const bands = {} as Record<ConvictionBand, BandCalibration>;
  for (const band of BANDS) {
    const { won, resolved } = tally[band];
    const empirical = resolved === 0 ? 0 : won / resolved;
    // Bayesian shrink toward the prior: (won + prior*K) / (resolved + K).
    const smoothed = (won + PRIOR[band] * K) / (resolved + K);
    bands[band] = {
      band,
      resolved,
      won,
      empiricalRate: pct(empirical),
      smoothedRate: pct(smoothed),
    };
  }

  return { bands, totalResolved: samples.length };
}

// Estimated probability a deal with this conviction score closes, given a model.
export function probabilityToClose(
  convictionScore: number,
  model: CalibrationModel = DEFAULT_CALIBRATION
): CloseProbability {
  const band = bandFor(convictionScore);
  const cal = model.bands[band];
  const basis: CloseProbability["basis"] =
    cal.resolved >= EMPIRICAL_MIN ? "empirical" : cal.resolved > 0 ? "blended" : "prior";
  return {
    pct: cal.smoothedRate,
    band,
    sampleSize: cal.resolved,
    basis,
  };
}

// Bundled resolved-deal history for demo/mock mode and as the default model.
// In live mode, rebuild from the org's own closed/withdrawn deals.
function rep(n: number, score: number, won: boolean): OutcomeSample[] {
  return Array.from({ length: n }, () => ({ convictionScore: score, won }));
}

export const HISTORICAL_OUTCOMES: OutcomeSample[] = [
  // hot band: 13 of 20 closed (65%)
  ...rep(13, 82, true),
  ...rep(7, 74, false),
  // warm band: 9 of 24 closed (~38%)
  ...rep(9, 52, true),
  ...rep(15, 45, false),
  // cold band: 2 of 18 closed (~11%)
  ...rep(2, 22, true),
  ...rep(16, 14, false),
];

export const DEFAULT_CALIBRATION: CalibrationModel =
  buildCalibration(HISTORICAL_OUTCOMES);

export function basisLabel(p: CloseProbability): string {
  if (p.basis === "empirical") return `from ${p.sampleSize} resolved comparables`;
  if (p.basis === "blended") return `${p.sampleSize} comparables + model prior`;
  return "model estimate — few comparable outcomes yet";
}
