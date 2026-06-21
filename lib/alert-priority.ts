// Noise-ranked alerts: score each matched alert by how much it deserves a human's
// attention, then collapse same-user+company duplicates so one busy deal doesn't
// fire five notifications in a run. Pure + unit-tested; the notify cron scores the
// matches it built, delivers the non-suppressed ones (in-app + webhook + email),
// and drops the rest. Conservative by design — it dedupes and ranks, it does not
// silently discard a user's subscription.

import type { AlertEvent, AlertRule } from "@/lib/alert-rules";
import type { Confidence } from "@/lib/types";

export type PriorityTier = "high" | "normal" | "low";

export interface ScoredAlert {
  rule: AlertRule;
  event: AlertEvent;
  score: number; // 0–100 attention priority
  tier: PriorityTier;
  // Collapsed as a near-duplicate of a higher-priority alert for the same
  // user+company in this run — not delivered.
  suppressed: boolean;
  // How many matched alerts (incl. this one) collapsed into the kept notification.
  duplicateCount: number;
}

// Event-type importance: a fresh live process is the headline; a quiet move to
// "on hold" is the least urgent.
const EVENT_WEIGHT: Record<string, number> = {
  moved_in_market: 1.0,
  new_entry: 0.65,
  pulled: 0.6,
  flagged: 0.55,
  moved_monitor: 0.45,
  moved_on_hold: 0.3,
};
const DEFAULT_EVENT_WEIGHT = 0.4;

const CONF_WEIGHT: Record<Confidence, number> = {
  high: 1,
  medium: 0.7,
  low: 0.4,
  needs_review: 0.2,
};

const WEIGHTS = {
  event: 0.4,
  conviction: 0.25,
  confidence: 0.2,
  recency: 0.15,
};

const RECENCY_HORIZON_HOURS = 72; // priority decays to 0 over ~3 days

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function tierFor(score: number): PriorityTier {
  if (score >= 66) return "high";
  if (score >= 40) return "normal";
  return "low";
}

export function scoreAlert(
  e: AlertEvent,
  now = Date.now()
): { score: number; tier: PriorityTier } {
  const evt = EVENT_WEIGHT[e.eventType] ?? DEFAULT_EVENT_WEIGHT;
  const conviction = clamp01((e.convictionScore ?? 50) / 100);
  const confidence = CONF_WEIGHT[e.confidence] ?? 0.3;
  const ageHours = (now - Date.parse(e.at)) / 3_600_000;
  const recency = Number.isFinite(ageHours)
    ? clamp01(1 - ageHours / RECENCY_HORIZON_HOURS)
    : 0.5;

  const weighted =
    WEIGHTS.event * evt +
    WEIGHTS.conviction * conviction +
    WEIGHTS.confidence * confidence +
    WEIGHTS.recency * recency;

  const score = Math.round(clamp01(weighted) * 100);
  return { score, tier: tierFor(score) };
}

// Score every matched alert, then collapse same-user+company duplicates to the
// single highest-priority one. Returns every alert (suppressed flagged) sorted by
// score desc, so callers can deliver the kept ones and log what was collapsed.
export function rankAndDedupe(
  matches: { rule: AlertRule; event: AlertEvent }[],
  now = Date.now()
): ScoredAlert[] {
  const scored: ScoredAlert[] = matches.map(({ rule, event }) => {
    const { score, tier } = scoreAlert(event, now);
    return { rule, event, score, tier, suppressed: false, duplicateCount: 1 };
  });

  // Group by recipient + company; the highest score wins, the rest are collapsed.
  const groups = new Map<string, ScoredAlert[]>();
  for (const s of scored) {
    const key = `${s.rule.userId}:${s.event.companyId}`;
    const g = groups.get(key) ?? [];
    g.push(s);
    groups.set(key, g);
  }

  for (const g of groups.values()) {
    if (g.length === 1) continue;
    g.sort((a, b) => b.score - a.score || a.rule.id.localeCompare(b.rule.id));
    const [kept, ...rest] = g;
    kept!.duplicateCount = g.length;
    for (const s of rest) s.suppressed = true;
  }

  return scored.sort((a, b) => b.score - a.score);
}

// The alerts to actually deliver: non-suppressed, highest-priority first.
export function deliverable(scored: ScoredAlert[]): ScoredAlert[] {
  return scored.filter((s) => !s.suppressed).sort((a, b) => b.score - a.score);
}
