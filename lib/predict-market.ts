// Predictive "coming-to-market" score: a 0–100 estimate of how likely a
// not-yet-in-market asset is to enter a formal sale process in the near term,
// with a horizon band. Where conviction scores deals that are ALREADY moving,
// this looks one step earlier — flagging assets before a banker is mandated.
//
// It blends the classic PE exit drivers: hold-period ripeness (funds exit on a
// 3–6yr clock), how close the deal already sits to market, recent signal
// momentum, sector exit activity, and debt-maturity (refi-wall) pressure.
// Pure + unit-tested so the weighting is auditable; every input beyond stage is
// optional and degrades to a neutral default, so it works on a bare company row
// today and sharpens as enrichment lands. Tune WEIGHTS, not callers.

import type { DealType, Stage } from "@/lib/types";
import type { MomentumTrend } from "@/lib/signal-momentum";

export type MarketTimingBand = "imminent" | "emerging" | "watch";

export interface MarketTiming {
  score: number; // 0–100 likelihood of coming to market within ~12 months
  band: MarketTimingBand;
  horizon: string; // human label for the expected window
  drivers: string[]; // top contributing factors, most important first
}

export interface MarketTimingInputs {
  stage: Stage;
  dealType: DealType;
  daysInStage: number;
  // Sponsor/parent ownership length in years, when known. The single strongest
  // predictor — left undefined it falls back to a neutral mid-ripeness.
  holdPeriodYears?: number;
  // Recent signal trend (from lib/signal-momentum). Accelerating chatter pulls
  // the timeline forward; cooling pushes it out.
  momentum?: MomentumTrend;
  // Sector exit activity, 0..1 (e.g. share of the sector already in market).
  // Neutral 0.5 when unknown.
  sectorHeat?: number;
  // A debt maturity / refinancing wall inside ~18 months — a classic forced-sale
  // catalyst for sponsor-backed assets.
  debtMaturityPressure?: boolean;
  // The sponsor's typical hold-to-exit length, when their pattern is known.
  // Being near it sharpens hold-ripeness.
  sponsorExitCadenceYears?: number;
}

// Sub-score weights (sum to 1).
const WEIGHTS = {
  holdRipeness: 0.32,
  stageProximity: 0.28,
  momentum: 0.18,
  sectorHeat: 0.1,
  debtPressure: 0.12,
};

const MOMENTUM_WEIGHT: Record<MomentumTrend, number> = {
  accelerating: 1,
  stable: 0.5,
  cooling: 0.15,
};

const IMMINENT_FLOOR = 60;
const EMERGING_FLOOR = 35;

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function bandFor(score: number): MarketTimingBand {
  if (score >= IMMINENT_FLOOR) return "imminent";
  if (score >= EMERGING_FLOOR) return "emerging";
  return "watch";
}

// Likelihood a PE hold is "ripe" for exit. Ramps from ~1yr, peaks across the
// typical 4–7yr exit window, then eases (but stays high — an overdue asset is
// under pressure to return capital). Undefined hold → neutral mid value.
export function holdRipeness(years: number | undefined, cadence?: number): number {
  let base: number;
  if (years === undefined) {
    base = 0.4;
  } else if (years < 1) {
    base = 0.1;
  } else if (years < 4) {
    base = 0.1 + (0.9 * (years - 1)) / 3; // 0.1 → 1.0 across yr 1–4
  } else if (years <= 7) {
    base = 1; // prime exit window
  } else {
    base = 0.85; // overdue; still likely, slight tail-off
  }
  // Near a sponsor's known exit cadence sharpens ripeness toward certainty.
  if (cadence !== undefined && years !== undefined && Math.abs(years - cadence) <= 1) {
    base = Math.max(base, 0.95);
  }
  return clamp01(base);
}

// How close the asset already sits to a formal process. monitor_for_exit is the
// on-deck circle; on_hold is further back and decays if it has stalled for long.
function stageProximity(stage: Stage, daysInStage: number): number {
  if (stage === "monitor_for_exit") {
    // Warmed up: sitting in "monitor" a while signals an exit is being teed up.
    return clamp01(0.7 + (daysInStage > 60 ? 0.2 : 0));
  }
  if (stage === "on_hold") {
    // A long-parked hold reads as stalled, not imminent.
    return daysInStage > 365 ? 0.2 : 0.35;
  }
  return 0; // in_market / pulled are handled before we get here
}

function buildDrivers(i: MarketTimingInputs, ripeness: number): string[] {
  const drivers: Array<{ weight: number; text: string }> = [];

  if (i.holdPeriodYears !== undefined && ripeness >= 0.85) {
    drivers.push({
      weight: 5,
      text: `${formatYears(i.holdPeriodYears)} hold — in the typical exit window`,
    });
  } else if (i.holdPeriodYears !== undefined && i.holdPeriodYears < 2) {
    drivers.push({
      weight: 1,
      text: `Early in hold (${formatYears(i.holdPeriodYears)})`,
    });
  }

  if (i.debtMaturityPressure) {
    drivers.push({ weight: 4.5, text: "Debt maturity approaching — refi pressure" });
  }
  if (i.momentum === "accelerating") {
    drivers.push({ weight: 4, text: "Signal activity accelerating" });
  } else if (i.momentum === "cooling") {
    drivers.push({ weight: 1.5, text: "Signal activity cooling" });
  }
  if (i.stage === "monitor_for_exit" && i.daysInStage > 60) {
    drivers.push({ weight: 3, text: "Actively monitored for exit" });
  }
  if (i.sectorHeat !== undefined && i.sectorHeat >= 0.6) {
    drivers.push({ weight: 2.5, text: "Sector exit activity elevated" });
  }
  if (
    i.sponsorExitCadenceYears !== undefined &&
    i.holdPeriodYears !== undefined &&
    Math.abs(i.holdPeriodYears - i.sponsorExitCadenceYears) <= 1
  ) {
    drivers.push({ weight: 3.5, text: "Near sponsor's usual hold length" });
  }

  return drivers
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((d) => d.text);
}

function formatYears(years: number): string {
  const rounded = Math.round(years * 10) / 10;
  return `${rounded}yr`;
}

export function computeMarketTiming(i: MarketTimingInputs): MarketTiming {
  // Already in market: prediction is moot — it has arrived.
  if (i.stage === "in_market") {
    return {
      score: 100,
      band: "imminent",
      horizon: "In market now",
      drivers: ["Already in market"],
    };
  }
  // A pulled process is a decision NOT to transact — dormant until something new.
  if (i.stage === "pulled") {
    return {
      score: 10,
      band: "watch",
      horizon: "Dormant — process pulled",
      drivers: ["Process pulled"],
    };
  }

  const ripeness = holdRipeness(i.holdPeriodYears, i.sponsorExitCadenceYears);
  const proximity = stageProximity(i.stage, i.daysInStage);
  const momentum = i.momentum ? MOMENTUM_WEIGHT[i.momentum] : 0.5;
  const sectorHeat = clamp01(i.sectorHeat ?? 0.5);
  const debt = i.debtMaturityPressure ? 1 : 0;

  const weighted =
    WEIGHTS.holdRipeness * ripeness +
    WEIGHTS.stageProximity * proximity +
    WEIGHTS.momentum * momentum +
    WEIGHTS.sectorHeat * sectorHeat +
    WEIGHTS.debtPressure * debt;

  const score = Math.round(clamp01(weighted) * 100);
  const band = bandFor(score);

  return {
    score,
    band,
    horizon: HORIZON[band],
    drivers: buildDrivers(i, ripeness),
  };
}

const HORIZON: Record<MarketTimingBand, string> = {
  imminent: "0–6 months",
  emerging: "6–18 months",
  watch: ">18 months",
};

export const MARKET_TIMING_LABEL: Record<MarketTimingBand, string> = {
  imminent: "Imminent",
  emerging: "Emerging",
  watch: "Watch",
};

// AA-contrast dot colors (decorative dots only — never text on white).
export const MARKET_TIMING_COLOR: Record<MarketTimingBand, string> = {
  imminent: "#157A5A",
  emerging: "#8A5712",
  watch: "#5f5e57",
};
