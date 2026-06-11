// Pure signal-momentum scorer. Groups a company's signals into 7-day buckets
// (last 12 weeks) and compares recent-4w vs prior-4w volume to classify
// the deal as accelerating / stable / cooling.

import type { Signal } from "@/lib/types";

export type MomentumTrend = "accelerating" | "stable" | "cooling";

export interface MomentumResult {
  trend: MomentumTrend;
  // Signal count per week, oldest first (12 entries).
  sparkline: number[];
  // Human label for the trend.
  label: string;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const WEEKS = 12;

const LABELS: Record<MomentumTrend, string> = {
  accelerating: "Accelerating",
  stable: "Stable",
  cooling: "Cooling",
};

export function computeMomentum(signals: Signal[], now = Date.now()): MomentumResult {
  if (signals.length === 0) {
    return {
      trend: "stable",
      sparkline: Array<number>(WEEKS).fill(0),
      label: LABELS.stable,
    };
  }

  // Build weekly buckets newest-first, then reverse so index 0 = oldest.
  const buckets = Array.from({ length: WEEKS }, (_, i) => {
    const end = now - i * WEEK_MS;
    const start = end - WEEK_MS;
    return signals.filter((s) => {
      const t = new Date(s.ingestedAt).getTime();
      return t >= start && t < end;
    }).length;
  }).reverse();

  // Recent = last 4 weeks (indices 8–11). Prior = weeks 4–7.
  const recent = buckets.slice(8).reduce((a, b) => a + b, 0);
  const prior = buckets.slice(4, 8).reduce((a, b) => a + b, 0);

  let trend: MomentumTrend;
  if (prior === 0 && recent > 0) {
    trend = "accelerating";
  } else if (recent > prior * 1.5 && recent > 0) {
    trend = "accelerating";
  } else if (prior > 0 && recent < prior * 0.5) {
    trend = "cooling";
  } else {
    trend = "stable";
  }

  return { trend, sparkline: buckets, label: LABELS[trend] };
}
