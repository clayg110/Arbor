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
  SignalSourceRow,
  TransitionRateRow,
  SummaryCountsRow,
  SummaryMetricsRow,
  EventCountsRow,
  RecentChangeRow,
} from "@/types/db";
import type { Stage, Sector, SourceType } from "@/lib/types";
import { SECTOR_LABELS, DEAL_TYPE_LABELS, CHART } from "@/lib/colors";
import { relativeLabel } from "./time";

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
    return { i, label, carveout: r.carveout, private_asset: r.private_asset, total: r.total, rolling };
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
  const picked = FUNNEL_ORDER.map((s) => byStage.get(s)).filter(Boolean) as ExitFunnelRow[];
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
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
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
