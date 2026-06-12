// Pure helpers for LP / fund-level reporting. No I/O. Given a flat list of deals
// (each optionally assigned to a fund) and the fund directory, `buildLpReport`
// produces a quarterly snapshot grouped by fund (vintage) × sector — the kind of
// one-pager an enterprise GP sends to limited partners. `lpReportToCsv` flattens
// it for download.

import { STAGE_LABELS } from "@/lib/colors";
import { toCsv, type CsvColumn } from "@/lib/csv";
import type { Stage } from "@/lib/types";

export interface LpFund {
  id: string;
  name: string;
  vintageYear: number | null;
}

export interface LpDeal {
  companyId: string;
  companyName: string;
  sector: string;
  fundId: string | null;
  stage: Stage;
  conviction: number | null;
  bidCount: number;
  createdAt: string; // ISO; used for "new this quarter"
}

export interface StageCount {
  stage: Stage;
  label: string;
  count: number;
}

export interface SectorCount {
  sector: string;
  count: number;
}

export interface FundSnapshot {
  fund: LpFund | null; // null = the "Unassigned" bucket
  dealCount: number;
  newThisQuarter: number;
  byStage: StageCount[];
  bySector: SectorCount[];
  avgConviction: number | null;
  totalBids: number;
}

export interface LpReport {
  quarter: string; // "2026-Q2"
  quarterStart: string; // ISO (inclusive)
  quarterEnd: string; // ISO (exclusive)
  generatedAt: string;
  totalDeals: number;
  funds: FundSnapshot[];
}

const QUARTER_RE = /^(\d{4})-Q([1-4])$/;

// "2026-Q2" → { year: 2026, quarter: 2 }, or null if malformed.
export function parseQuarter(q: string): { year: number; quarter: number } | null {
  const m = QUARTER_RE.exec(q.trim());
  if (!m) return null;
  return { year: Number(m[1]), quarter: Number(m[2]) };
}

// Calendar quarter that `date` falls in, e.g. "2026-Q2".
export function currentQuarter(date: Date = new Date()): string {
  const q = Math.floor(date.getUTCMonth() / 3) + 1;
  return `${date.getUTCFullYear()}-Q${q}`;
}

// Half-open [start, end) ISO range for a quarter. end is the first instant of
// the next quarter, so membership is `start <= t < end`.
export function quarterRange(q: string): { start: string; end: string } | null {
  const parsed = parseQuarter(q);
  if (!parsed) return null;
  const startMonth = (parsed.quarter - 1) * 3;
  const start = new Date(Date.UTC(parsed.year, startMonth, 1));
  const end = new Date(Date.UTC(parsed.year, startMonth + 3, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

function isInQuarter(iso: string, start: string, end: string): boolean {
  return iso >= start && iso < end;
}

function snapshot(
  fund: LpFund | null,
  deals: LpDeal[],
  range: { start: string; end: string }
): FundSnapshot {
  const stageCounts = new Map<Stage, number>();
  const sectorCounts = new Map<string, number>();
  let convSum = 0;
  let convN = 0;
  let totalBids = 0;
  let newThisQuarter = 0;

  for (const d of deals) {
    stageCounts.set(d.stage, (stageCounts.get(d.stage) ?? 0) + 1);
    sectorCounts.set(d.sector, (sectorCounts.get(d.sector) ?? 0) + 1);
    if (d.conviction !== null) {
      convSum += d.conviction;
      convN += 1;
    }
    totalBids += d.bidCount;
    if (isInQuarter(d.createdAt, range.start, range.end)) newThisQuarter += 1;
  }

  // Stage rows in canonical pipeline order; drop zero-count stages.
  const byStage: StageCount[] = (Object.keys(STAGE_LABELS) as Stage[])
    .filter((s) => stageCounts.has(s))
    .map((s) => ({ stage: s, label: STAGE_LABELS[s], count: stageCounts.get(s)! }));

  const bySector: SectorCount[] = [...sectorCounts.entries()]
    .map(([sector, count]) => ({ sector, count }))
    .sort((a, b) => b.count - a.count || a.sector.localeCompare(b.sector));

  return {
    fund,
    dealCount: deals.length,
    newThisQuarter,
    byStage,
    bySector,
    avgConviction: convN > 0 ? Math.round((convSum / convN) * 10) / 10 : null,
    totalBids,
  };
}

// Build the quarterly LP snapshot. Deals are grouped by fund; unassigned deals
// form a trailing "Unassigned" bucket. Funds are ordered newest-vintage first,
// then by name, so the freshest vehicle leads the report.
export function buildLpReport(
  deals: LpDeal[],
  funds: LpFund[],
  quarter: string,
  now: Date = new Date()
): LpReport {
  const range = quarterRange(quarter);
  if (!range) {
    throw new Error(`Invalid quarter: ${quarter} (expected e.g. "2026-Q2")`);
  }

  const byFund = new Map<string | null, LpDeal[]>();
  for (const d of deals) {
    const key = d.fundId ?? null;
    const list = byFund.get(key);
    if (list) list.push(d);
    else byFund.set(key, [d]);
  }

  const ordered = [...funds].sort(
    (a, b) =>
      (b.vintageYear ?? -Infinity) - (a.vintageYear ?? -Infinity) ||
      a.name.localeCompare(b.name)
  );

  const sections: FundSnapshot[] = [];
  for (const f of ordered) {
    const fundDeals = byFund.get(f.id);
    if (!fundDeals || fundDeals.length === 0) continue; // skip empty funds
    sections.push(snapshot(f, fundDeals, range));
  }

  const unassigned = byFund.get(null);
  if (unassigned && unassigned.length > 0) {
    sections.push(snapshot(null, unassigned, range));
  }

  return {
    quarter,
    quarterStart: range.start,
    quarterEnd: range.end,
    generatedAt: now.toISOString(),
    totalDeals: deals.length,
    funds: sections,
  };
}

// One row per fund × stage for a spreadsheet-friendly LP export.
export function lpReportToCsv(report: LpReport): string {
  interface Row {
    fund: string;
    vintage: string;
    sectorTop: string;
    stage: string;
    count: number;
    newThisQuarter: number;
    avgConviction: string;
    totalBids: number;
  }
  const rows: Row[] = [];
  for (const s of report.funds) {
    const fundName = s.fund?.name ?? "Unassigned";
    const vintage = s.fund?.vintageYear != null ? String(s.fund.vintageYear) : "";
    const sectorTop = s.bySector[0]?.sector ?? "";
    if (s.byStage.length === 0) {
      rows.push({
        fund: fundName,
        vintage,
        sectorTop,
        stage: "",
        count: 0,
        newThisQuarter: s.newThisQuarter,
        avgConviction: s.avgConviction != null ? String(s.avgConviction) : "",
        totalBids: s.totalBids,
      });
      continue;
    }
    for (const st of s.byStage) {
      rows.push({
        fund: fundName,
        vintage,
        sectorTop,
        stage: st.label,
        count: st.count,
        newThisQuarter: s.newThisQuarter,
        avgConviction: s.avgConviction != null ? String(s.avgConviction) : "",
        totalBids: s.totalBids,
      });
    }
  }

  const columns: CsvColumn<Row>[] = [
    { header: "Fund", value: (r) => r.fund },
    { header: "Vintage", value: (r) => r.vintage },
    { header: "Top sector", value: (r) => r.sectorTop },
    { header: "Stage", value: (r) => r.stage },
    { header: "Deals in stage", value: (r) => r.count },
    { header: "New this quarter", value: (r) => r.newThisQuarter },
    { header: "Avg conviction", value: (r) => r.avgConviction },
    { header: "Total bids", value: (r) => r.totalBids },
  ];
  return toCsv(rows, columns);
}
