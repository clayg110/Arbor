// Pure helpers for the per-company signal timeline. No I/O.

import type { Signal, SourceType } from "./types";

export interface TimelineDot {
  key: string;
  date: string; // ISO YYYY-MM-DD
  x: number; // 0–100 (% of timeline width)
  signals: Signal[];
  primarySource: SourceType;
}

export interface MonthTick {
  label: string;
  x: number; // 0–100
}

export interface SignalTimeline {
  dots: TimelineDot[];
  ticks: MonthTick[];
  startDate: string;
  endDate: string;
}

const MONTH_ABBR = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function toMs(isoDate: string): number {
  return new Date(isoDate + "T00:00:00").getTime();
}

// SOURCE_PRIORITY determines which sourceType "wins" when multiple signals
// share a date — for dot coloring. Higher index = higher priority.
const SOURCE_PRIORITY: SourceType[] = [
  "manual",
  "rss_feed",
  "google_news",
  "earnings_transcript",
  "hsr_filing",
  "sec_filing",
];

function primarySource(signals: Signal[]): SourceType {
  let best = signals[0]!.sourceType;
  let bestPriority = SOURCE_PRIORITY.indexOf(best);
  for (const s of signals) {
    const p = SOURCE_PRIORITY.indexOf(s.sourceType);
    if (p > bestPriority) {
      best = s.sourceType;
      bestPriority = p;
    }
  }
  return best;
}

export function buildSignalTimeline(
  signals: Signal[],
  endDateStr: string, // ISO date — passed in for testability
  months = 12
): SignalTimeline {
  const endMs = toMs(endDateStr);
  // Use average month = 30.44 days for consistent range across any endDate.
  const startMs = endMs - months * 30.44 * 86_400_000;
  const rangeMs = endMs - startMs;

  function pct(ms: number): number {
    return Math.max(0, Math.min(100, ((ms - startMs) / rangeMs) * 100));
  }

  // Group signals by exact date string; exclude out-of-range.
  const byDate = new Map<string, Signal[]>();
  for (const s of signals) {
    if (!s.ingestedAt) continue;
    const dateMs = toMs(s.ingestedAt.slice(0, 10));
    if (dateMs < startMs || dateMs > endMs + 86_400_000) continue;
    const key = s.ingestedAt.slice(0, 10);
    const group = byDate.get(key) ?? [];
    group.push(s);
    byDate.set(key, group);
  }

  const dots: TimelineDot[] = [];
  for (const [date, sigs] of byDate) {
    dots.push({
      key: date,
      date,
      x: pct(toMs(date)),
      signals: sigs,
      primarySource: primarySource(sigs),
    });
  }
  dots.sort((a, b) => a.x - b.x);

  // Month ticks: first day of each month that falls within [startMs, endMs].
  const ticks: MonthTick[] = [];
  const d = new Date(startMs);
  let y = d.getFullYear();
  let m = d.getMonth() + 1; // advance to next month
  if (m > 11) {
    m = 0;
    y++;
  }
  while (true) {
    const tickMs = new Date(y, m, 1).getTime();
    if (tickMs > endMs) break;
    ticks.push({ label: MONTH_ABBR[m]!, x: pct(tickMs) });
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }

  return {
    dots,
    ticks,
    startDate: new Date(startMs).toISOString().slice(0, 10),
    endDate: endDateStr,
  };
}
