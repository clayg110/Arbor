// View / RPC rows → analytics + radar-summary frontend shapes. Pure.

import type {
  VelocityRow,
  HeatmapRow,
  SectorStageRow,
  DealSplitRow,
  ConfidenceDistRow,
  ExitFunnelRow,
  TopSectorRow,
  SponsorActivityRow,
  SponsorHoldingRow,
  CalibrationRow,
  SignalSourceRow,
  TransitionRateRow,
  SummaryCountsRow,
  SummaryMetricsRow,
  EventCountsRow,
  RecentChangeRow,
  FunnelCohortRow,
  ValuationMultipleRow,
  WinLossRow,
} from "@/types/db";
import type { Stage, Sector, SourceType } from "@/lib/types";
import { SECTOR_LABELS, DEAL_TYPE_LABELS, CHART } from "@/lib/colors";
import { relativeLabel } from "./time";

const MONTH = [
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

export interface VelocityPointData {
  i: number;
  label: string;
  carveout: number;
  private_asset: number;
  total: number;
  rolling: number;
}
export function toVelocity(rows: VelocityRow[]): VelocityPointData[] {
  let prevMonth = -1;
  return rows.map((r, i) => {
    const start = Math.max(0, i - 3);
    let sum = 0;
    for (let k = start; k <= i; k++) sum += rows[k].total;
    const rolling = +(sum / (i - start + 1)).toFixed(1);
    const month = new Date(r.week_start + "T12:00:00").getMonth();
    const label = month !== prevMonth ? MONTH[month] : "";
    prevMonth = month;
    return {
      i,
      label,
      carveout: r.carveout,
      private_asset: r.private_asset,
      total: r.total,
      rolling,
    };
  });
}

export interface SectorStageData {
  sector: string;
  sectorKey: Sector;
  in_market: number;
  monitor: number;
  on_hold: number;
  total: number;
}
export function toSectorStage(rows: SectorStageRow[]): SectorStageData[] {
  return rows
    .map((r) => ({
      sector: SECTOR_LABELS[r.sector],
      sectorKey: r.sector,
      in_market: r.in_market,
      monitor: r.monitor,
      on_hold: r.on_hold,
      total: r.total,
    }))
    .sort((a, b) => b.total - a.total);
}

export function toDealSplit(rows: DealSplitRow[]) {
  const total = rows.reduce((s, r) => s + r.value, 0);
  return {
    total,
    parts: rows.map((r) => ({
      name: DEAL_TYPE_LABELS[r.deal_type],
      value: r.value,
      pct: r.pct,
      color: r.deal_type === "carveout" ? CHART.carveout : CHART.private_asset,
    })),
  };
}

const CONF_META: Record<string, { label: string; color: string; order: number }> = {
  high: { label: "High", color: "#1D9E75", order: 0 },
  medium: { label: "Medium", color: "#BA7517", order: 1 },
  low: { label: "Low", color: "#E24B4A", order: 2 },
  needs_review: { label: "Needs review", color: "#B4B2A9", order: 3 },
};
export function toConfidenceDist(rows: ConfidenceDistRow[]) {
  return rows
    .map((r) => ({ ...CONF_META[r.confidence], count: r.count, pct: r.pct }))
    .sort((a, b) => a.order - b.order);
}

const FUNNEL_STYLE: Record<string, { bg: string; border: string }> = {
  monitor_for_exit: { bg: "#E6F1FB", border: "#185FA5" },
  in_market: { bg: "#FAEEDA", border: "#BA7517" },
  pulled: { bg: "#FCEBEB", border: "#E24B4A" },
};
const FUNNEL_ORDER: Stage[] = ["monitor_for_exit", "in_market", "pulled"];
const STAGE_SHORT: Record<Stage, string> = {
  in_market: "In market",
  monitor_for_exit: "Monitor for exit",
  on_hold: "On hold",
  pulled: "Pulled / lapsed",
};
export function toExitFunnel(rows: ExitFunnelRow[]) {
  const byStage = new Map(rows.map((r) => [r.stage, r]));
  const picked = FUNNEL_ORDER.map((s) => byStage.get(s)).filter(
    Boolean
  ) as ExitFunnelRow[];
  const max = Math.max(...picked.map((r) => r.avg_days), 1);
  return picked.map((r) => ({
    stage: STAGE_SHORT[r.stage],
    days: r.avg_days,
    width: Math.round((r.avg_days / max) * 100),
    n: r.n,
    ...FUNNEL_STYLE[r.stage],
  }));
}

export function toTopSectors(rows: TopSectorRow[]) {
  return rows.map((r) => ({
    sector: SECTOR_LABELS[r.sector],
    sectorKey: r.sector,
    days: r.avg_days,
    n: r.n,
  }));
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
export function toSponsors(rows: SponsorActivityRow[]) {
  return rows.slice(0, 6).map((r, i) => ({
    rank: i + 1,
    name: r.sponsor,
    slug: slugify(r.sponsor),
    processes: r.processes,
    sector: SECTOR_LABELS[r.top_sector],
  }));
}

const SOURCE_META: Record<SourceType, { name: string; short: string }> = {
  sec_filing: { name: "SEC Filings", short: "SEC" },
  earnings_transcript: { name: "Earnings Calls", short: "Earnings" },
  google_news: { name: "Google News", short: "News" },
  rss_feed: { name: "RSS / PE Wire", short: "RSS" },
  manual: { name: "Manual entry", short: "Manual" },
  hsr_filing: { name: "HSR Filings", short: "HSR" },
};
export function toSignalSources(rows: SignalSourceRow[]) {
  return rows.map((r) => ({ ...SOURCE_META[r.source_type], count: r.count, pct: r.pct }));
}

export interface HeatDayData {
  date: string;
  count: number;
  stageChanges: number;
  newEntries: number;
  dow: number;
}
export function toHeatmap(rows: HeatmapRow[]): HeatDayData[] {
  return rows.map((r) => {
    const d = new Date(r.day + "T12:00:00");
    return {
      date: r.day,
      count: r.events,
      stageChanges: r.stage_changes,
      newEntries: r.new_entries,
      dow: (d.getDay() + 6) % 7, // Mon=0
    };
  });
}

export function toTransitionRates(rows: TransitionRateRow[]) {
  return rows
    .sort((a, b) => b.pct - a.pct)
    .map((r) => ({
      label: `${STAGE_SHORT[r.from_stage]} → ${STAGE_SHORT[r.to_stage]}`,
      pct: r.pct,
    }));
}

export function toSummaryStrip(row: SummaryCountsRow) {
  return {
    total: row.total,
    inMarket: row.in_market,
    monitor: row.monitor,
    onHold: row.on_hold,
    needsReview: row.needs_review,
    newThisWeek: row.new_this_week,
    newCarveout: row.new_carveout,
    newPrivate: row.new_private,
  };
}

export function toSectorSummary(rows: SectorStageRow[]) {
  return rows
    .map((r) => ({
      key: r.sector,
      label: SECTOR_LABELS[r.sector],
      total: r.total,
      inMarket: r.in_market,
      monitor: r.monitor,
      onHold: r.on_hold,
    }))
    .sort((a, b) => b.total - a.total);
}

// Feed-sidebar "Activity summary" stats for a range.
export function toRangeStats(row: EventCountsRow) {
  return {
    stageChanges: row.stage_changes,
    newEntries: row.new_entries,
    pulled: row.pulled,
    flagged: row.flagged,
    confidence: row.confidence_updates,
  };
}

export interface RecentChangeData {
  id: string;
  company: string;
  companyId: string;
  from: Stage | null;
  to: Stage;
  source: SourceType;
  time: string;
}
export function toRecentChanges(rows: RecentChangeRow[]): RecentChangeData[] {
  return rows.map((r) => ({
    id: r.id,
    company: r.name,
    companyId: r.company_id,
    from: r.from_stage,
    to: r.to_stage,
    source: r.source_type ?? "manual",
    time: relativeLabel(r.changed_at),
  }));
}

export interface SponsorHoldingData {
  sponsor: string;
  slug: string;
  totalDeals: number;
  marketCount: number;
  avgDaysHold: number | null;
  exitRatePct: number;
  topSector: string;
}
export function toSponsorHolding(rows: SponsorHoldingRow[]): SponsorHoldingData[] {
  return rows.slice(0, 8).map((r) => ({
    sponsor: r.sponsor,
    slug: slugify(r.sponsor),
    totalDeals: r.total_deals,
    marketCount: r.market_count,
    avgDaysHold: r.avg_days_hold,
    exitRatePct: r.exit_rate_pct,
    topSector: SECTOR_LABELS[r.top_sector] ?? r.top_sector,
  }));
}

export interface CalibrationData {
  label: string;
  confidence: string;
  total: number;
  closedCount: number;
  lostCount: number;
  closeRatePct: number;
  color: string;
}
export function toCalibration(rows: CalibrationRow[]): CalibrationData[] {
  return rows.map((r) => ({
    label: CONF_META[r.confidence]?.label ?? r.confidence,
    confidence: r.confidence,
    total: r.total,
    closedCount: r.closed_count,
    lostCount: r.lost_count,
    closeRatePct: r.close_rate_pct,
    color: CONF_META[r.confidence]?.color ?? "#B4B2A9",
  }));
}

// Display values for the 6 analytics metric cards (merge with static METRICS).
export function toMetricValues(row: SummaryMetricsRow): Record<string, string> {
  return {
    new_deals: String(row.new_deals),
    stage_changes: String(row.stage_changes),
    avg_days: `${row.avg_days_market} days`,
    pulled: String(row.pulled),
    needs_review: String(row.needs_review),
    confidence: Number(row.avg_confidence).toFixed(2),
  };
}

// ---- Conversion funnel cohorts ----
// Groups stage-entry rows into months and pivots to a recharts-friendly shape:
// [{ month: "Jan 2025", in_market: 3, monitor_for_exit: 7, on_hold: 1 }, ...]

export interface FunnelCohortData {
  month: string; // e.g. "Jan 2025"
  in_market: number;
  monitor_for_exit: number;
  on_hold: number;
  pulled: number;
}

export function toFunnelCohorts(rows: FunnelCohortRow[]): FunnelCohortData[] {
  const map = new Map<string, FunnelCohortData>();
  for (const r of rows) {
    const d = new Date(r.cohort_month + "T12:00:00");
    const key = r.cohort_month;
    const label = `${MONTH[d.getMonth()]} ${d.getFullYear()}`;
    const entry = map.get(key) ?? {
      month: label,
      in_market: 0,
      monitor_for_exit: 0,
      on_hold: 0,
      pulled: 0,
    };
    const stage = r.stage as keyof Omit<FunnelCohortData, "month">;
    if (stage in entry) entry[stage] = r.entries;
    map.set(key, entry);
  }
  return [...map.values()];
}

// ---- Valuation multiples by sector ----
export interface ValuationMultipleData {
  sector: string; // human label
  sectorKey: string;
  deals: number;
  avgMultiple: number | null;
  medianMultiple: number | null;
}

export function toValuationMultiples(
  rows: ValuationMultipleRow[]
): ValuationMultipleData[] {
  return rows
    .filter((r) => r.deals > 0)
    .map((r) => ({
      sector: (SECTOR_LABELS as Record<string, string>)[r.sector] ?? r.sector,
      sectorKey: r.sector,
      deals: r.deals,
      avgMultiple: r.avg_multiple,
      medianMultiple: r.median_multiple,
    }));
}

// ---- Win/loss by sector and confidence ----
export interface WinLossData {
  bySector: { sector: string; sectorKey: string; wins: number; losses: number }[];
  byConfidence: { label: string; wins: number; losses: number }[];
  totals: { wins: number; losses: number; winRate: number };
}

export function toWinLoss(rows: WinLossRow[]): WinLossData {
  const sectorMap = new Map<string, { wins: number; losses: number }>();
  const confMap = new Map<string, { wins: number; losses: number }>();
  let totalWins = 0;
  let totalLosses = 0;

  for (const r of rows) {
    const s = sectorMap.get(r.sector) ?? { wins: 0, losses: 0 };
    s.wins += r.wins;
    s.losses += r.losses;
    sectorMap.set(r.sector, s);

    const cf = confMap.get(r.confidence) ?? { wins: 0, losses: 0 };
    cf.wins += r.wins;
    cf.losses += r.losses;
    confMap.set(r.confidence, cf);

    totalWins += r.wins;
    totalLosses += r.losses;
  }

  const total = totalWins + totalLosses;
  const winRate = total === 0 ? 0 : Math.round((totalWins / total) * 100);

  const CONF_ORDER: Record<string, number> = {
    high: 0,
    medium: 1,
    low: 2,
    needs_review: 3,
  };

  return {
    bySector: [...sectorMap.entries()]
      .map(([sector, v]) => ({
        sector: (SECTOR_LABELS as Record<string, string>)[sector] ?? sector,
        sectorKey: sector,
        ...v,
      }))
      .sort((a, b) => b.wins + b.losses - (a.wins + a.losses)),
    byConfidence: [...confMap.entries()]
      .map(([confidence, v]) => ({
        label: CONF_META[confidence]?.label ?? confidence,
        confidence,
        ...v,
      }))
      .sort((a, b) => (CONF_ORDER[a.confidence] ?? 9) - (CONF_ORDER[b.confidence] ?? 9)),
    totals: { wins: totalWins, losses: totalLosses, winRate },
  };
}
