// Shared analytics + date-range data. Used by /analytics and the /feed sidebar.
// Anchor "today" = 2026-06-03 (matches the feed mock).

export type Preset = "today" | "week" | "month" | "30d" | "custom";

export const ANCHOR = "2026-06-03";

export const PRESETS: { v: Preset; label: string }[] = [
  { v: "today", label: "Today" },
  { v: "week", label: "This week" },
  { v: "month", label: "This month" },
  { v: "30d", label: "Last 30 days" },
  { v: "custom", label: "Custom" },
];

export const PRESET_LABEL: Record<Preset, string> = {
  today: "Today",
  week: "This week",
  month: "This month",
  "30d": "Last 30 days",
  custom: "Custom range",
};

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(base: string, n: number): string {
  const d = new Date(base + "T12:00:00");
  d.setDate(d.getDate() + n);
  return iso(d);
}

// from/to span for each preset (relative to ANCHOR).
export function rangeDates(p: Preset): { from: string; to: string } {
  switch (p) {
    case "today":
      return { from: ANCHOR, to: ANCHOR };
    case "week":
      return { from: addDays(ANCHOR, -7), to: ANCHOR };
    case "month":
      return { from: addDays(ANCHOR, -31), to: ANCHOR };
    case "30d":
      return { from: addDays(ANCHOR, -30), to: ANCHOR };
    case "custom":
      return { from: addDays(ANCHOR, -7), to: ANCHOR };
  }
}

// range query-param token <-> preset
export function presetToToken(p: Preset): string {
  return p === "week" ? "week" : p === "month" ? "month" : p === "30d" ? "30d" : p === "today" ? "today" : "custom";
}
export function tokenToPreset(token: string | null | undefined): Preset | null {
  if (!token) return null;
  if (["today", "week", "month", "30d", "custom"].includes(token)) return token as Preset;
  return null;
}

// ---- range stats (5 categories) ----
export interface RangeStats {
  stageChanges: number;
  newEntries: number;
  pulled: number;
  flagged: number;
  confidence: number;
}

const STATS: Record<Exclude<Preset, "custom">, RangeStats> = {
  today: { stageChanges: 2, newEntries: 1, pulled: 0, flagged: 1, confidence: 0 },
  week: { stageChanges: 14, newEntries: 6, pulled: 2, flagged: 3, confidence: 4 },
  month: { stageChanges: 47, newEntries: 18, pulled: 6, flagged: 9, confidence: 11 },
  "30d": { stageChanges: 52, newEntries: 21, pulled: 7, flagged: 10, confidence: 13 },
};

export function statsFor(p: Preset): RangeStats {
  return p === "custom" ? STATS.week : STATS[p];
}

// ---- distribution bars per range ----
export interface DistBar {
  label: string;
  count: number;
  highlight?: boolean;
}

function daysBetween(from: string, to: string): number {
  const a = new Date(from + "T12:00:00").getTime();
  const b = new Date(to + "T12:00:00").getTime();
  return Math.round((b - a) / 86_400_000) + 1; // inclusive
}

// deterministic pseudo-count for a day offset
function dayCount(seed: number): number {
  const dow = ((seed % 7) + 7) % 7;
  if (dow === 5 || dow === 6) return (seed * 7) % 3; // weekend sparse 0-2
  return 2 + ((seed * 13) % 6); // weekday 2-7
}

export function distributionFor(p: Preset, from?: string, to?: string): DistBar[] {
  if (p === "today") return [{ label: "Today", count: 6, highlight: true }];
  if (p === "week")
    return [
      { label: "Mon", count: 7 },
      { label: "Tue", count: 6, highlight: true },
      { label: "Wed", count: 4 },
      { label: "Thu", count: 5 },
      { label: "Fri", count: 3 },
    ];
  if (p === "month")
    return [
      { label: "Wk 1", count: 22 },
      { label: "Wk 2", count: 28 },
      { label: "Wk 3", count: 19 },
      { label: "Wk 4", count: 24, highlight: true },
    ];
  if (p === "30d")
    return [
      { label: "Wk 1", count: 20 },
      { label: "Wk 2", count: 26 },
      { label: "Wk 3", count: 18 },
      { label: "Wk 4", count: 23 },
      { label: "Wk 5", count: 6, highlight: true },
    ];
  // custom
  const f = from ?? rangeDates("custom").from;
  const t = to ?? rangeDates("custom").to;
  const span = Math.max(1, daysBetween(f, t));
  if (span <= 14) {
    return Array.from({ length: span }).map((_, i) => {
      const d = new Date(f + "T12:00:00");
      d.setDate(d.getDate() + i);
      return {
        label: d.toLocaleDateString("en-US", { day: "numeric", month: "short" }),
        count: dayCount(i + 3),
        highlight: iso(d) === ANCHOR,
      };
    });
  }
  const weeks = Math.ceil(span / 7);
  return Array.from({ length: weeks }).map((_, i) => ({
    label: `Wk ${i + 1}`,
    count: 12 + ((i * 9 + 5) % 18),
  }));
}

// ---- metric cards (base = "week"; counts scale per range) ----
export interface MetricSpec {
  id: string;
  label: string;
  base: number;
  isRatio: boolean; // ratio metrics (days, confidence) don't scale by range
  display: (v: number) => string;
  delta: string;
  deltaTone: "good" | "neutral";
  deltaDir: "up" | "down";
  spark: number[];
}

export const METRICS: MetricSpec[] = [
  {
    id: "new_deals",
    label: "New deals tracked",
    base: 84,
    isRatio: false,
    display: (v) => String(Math.round(v)),
    delta: "+18% vs prior",
    deltaTone: "good",
    deltaDir: "up",
    spark: [40, 44, 42, 50, 55, 62, 84],
  },
  {
    id: "stage_changes",
    label: "Stage changes",
    base: 213,
    isRatio: false,
    display: (v) => String(Math.round(v)),
    delta: "+6% vs prior",
    deltaTone: "good",
    deltaDir: "up",
    spark: [180, 185, 190, 188, 200, 205, 213],
  },
  {
    id: "avg_days",
    label: "Avg. days in market",
    base: 47,
    isRatio: true,
    display: (v) => `${Math.round(v)} days`,
    delta: "-3 days vs prior",
    deltaTone: "good",
    deltaDir: "down",
    spark: [56, 54, 53, 51, 49, 48, 47],
  },
  {
    id: "pulled",
    label: "Deals pulled / lapsed",
    base: 31,
    isRatio: false,
    display: (v) => String(Math.round(v)),
    delta: "-8% vs prior",
    deltaTone: "good",
    deltaDir: "down",
    spark: [42, 40, 39, 37, 35, 33, 31],
  },
  {
    id: "needs_review",
    label: "Needs review queue",
    base: 12,
    isRatio: false,
    display: (v) => String(Math.round(v)),
    delta: "+4 since last week",
    deltaTone: "neutral",
    deltaDir: "up",
    spark: [6, 7, 8, 9, 10, 11, 12],
  },
  {
    id: "confidence",
    label: "Avg. extraction confidence",
    base: 0.81,
    isRatio: true,
    display: (v) => v.toFixed(2),
    delta: "+0.03 vs prior",
    deltaTone: "good",
    deltaDir: "up",
    spark: [0.74, 0.75, 0.77, 0.78, 0.79, 0.8, 0.81],
  },
];

const RANGE_SCALE: Record<Preset, number> = {
  today: 0.18,
  week: 1,
  month: 3.3,
  "30d": 3.7,
  custom: 1,
};

export function metricValue(m: MetricSpec, p: Preset): number {
  return m.isRatio ? m.base : m.base * RANGE_SCALE[p];
}

// ---- velocity (26 weeks) ----
const CARVE = [3, 1, 2, 4, 2, 3, 5, 4, 3, 6, 4, 5, 7, 5, 3, 6, 4, 2, 5, 3, 4, 6, 3, 5, 4, 6];
const PRIV = [2, 1, 1, 3, 0, 2, 3, 2, 4, 3, 2, 4, 4, 3, 2, 3, 3, 1, 4, 2, 3, 3, 2, 4, 3, 4];
const MONTH_AT: Record<number, string> = { 0: "Jan", 4: "Feb", 8: "Mar", 13: "Apr", 17: "May", 21: "Jun" };

export interface VelocityPoint {
  i: number;
  label: string; // month abbrev at boundary, else ""
  carveout: number;
  private_asset: number;
  total: number;
  rolling: number;
}

export const velocity: VelocityPoint[] = CARVE.map((c, i) => {
  const total = c + PRIV[i];
  const start = Math.max(0, i - 3);
  let sum = 0;
  for (let k = start; k <= i; k++) sum += CARVE[k] + PRIV[k];
  const rolling = +(sum / (i - start + 1)).toFixed(1);
  return { i, label: MONTH_AT[i] ?? "", carveout: c, private_asset: PRIV[i], total, rolling };
});

export const velocitySummary = {
  mostActive: "Week of Mar 3 — 11 new entries",
  quietest: "Week of Jan 6 — 2 new entries",
  avgPerWeek: "6.2 entries",
};

// ---- sector stage distribution ----
export interface SectorStage {
  sector: string;
  sectorKey: string;
  in_market: number;
  monitor: number;
  on_hold: number;
  total: number;
}
const SECTOR_RAW: [string, string, number, number, number][] = [
  ["Chemicals", "chemicals", 68, 142, 102],
  ["Industrials", "industrials", 42, 89, 67],
  ["Agriculture", "agriculture", 38, 67, 38],
  ["Specialty materials", "specialty_materials", 33, 52, 36],
  ["Energy & fuels", "energy_fuels", 27, 48, 33],
  ["Pharma inputs", "pharma_inputs", 21, 38, 33],
];
export const sectorStage: SectorStage[] = SECTOR_RAW.map(([sector, sectorKey, a, b, c]) => ({
  sector,
  sectorKey,
  in_market: a,
  monitor: b,
  on_hold: c,
  total: a + b + c,
}));

// ---- deal type split ----
export const dealSplit = {
  total: 1084,
  parts: [
    { name: "Carveouts", value: 629, pct: 58, color: "#185FA5" },
    { name: "Private assets", value: 455, pct: 42, color: "#1D9E75" },
  ],
};

// ---- confidence distribution ----
export const confidenceDist = [
  { label: "High", count: 612, pct: 56, color: "#1D9E75" },
  { label: "Medium", count: 298, pct: 27, color: "#BA7517" },
  { label: "Low", count: 98, pct: 9, color: "#E24B4A" },
  { label: "Needs review", count: 76, pct: 7, color: "#B4B2A9" },
];

// ---- exit funnel ----
export const exitFunnel = [
  { stage: "Monitor for exit", days: 287, width: 100, n: 436, bg: "#E6F1FB", border: "#185FA5" },
  { stage: "In market", days: 47, width: 68, n: 229, bg: "#FAEEDA", border: "#BA7517" },
  { stage: "Pulled / lapsed", days: 38, width: 38, n: 309, bg: "#FCEBEB", border: "#E24B4A" },
];

export const transitionRates = [
  { label: "Monitor → In market", pct: 34 },
  { label: "In market → Closed", pct: 28, note: "est." },
  { label: "In market → On hold", pct: 19 },
  { label: "On hold → Re-listed", pct: 11 },
];

// ---- top sectors by time in market ----
export const topSectors = [
  { sector: "Specialty materials", sectorKey: "specialty_materials", days: 63, n: 121 },
  { sector: "Agriculture", sectorKey: "agriculture", days: 51, n: 143 },
  { sector: "Chemicals", sectorKey: "chemicals", days: 47, n: 312 },
  { sector: "Industrials", sectorKey: "industrials", days: 39, n: 198 },
  { sector: "Energy & fuels", sectorKey: "energy_fuels", days: 31, n: 108 },
];

// ---- sponsors ----
export const sponsors = [
  { rank: 1, name: "Carlyle Group", slug: "carlyle", processes: 4, sector: "Specialty materials" },
  { rank: 2, name: "Bain Capital", slug: "bain", processes: 3, sector: "Pharma inputs" },
  { rank: 3, name: "One Rock Capital", slug: "one-rock", processes: 2, sector: "Chemicals" },
  { rank: 4, name: "SK Capital Partners", slug: "sk-capital", processes: 2, sector: "Specialty materials" },
  { rank: 5, name: "West Street Capital", slug: "west-street", processes: 1, sector: "Chemicals" },
  { rank: 6, name: "Advent International", slug: "advent", processes: 1, sector: "Industrials" },
];

// ---- signal source breakdown ----
const SIGNAL_RAW: [string, string, number][] = [
  ["SEC Filings", "SEC", 312],
  ["Earnings Calls", "Earnings", 198],
  ["PE Wire / News", "PE Wire", 187],
  ["Google News", "News", 143],
  ["Manual entry", "Manual", 52],
];
const SIGNAL_TOTAL = SIGNAL_RAW.reduce((a, [, , c]) => a + c, 0);
export const signalSources = SIGNAL_RAW.map(([name, short, count]) => ({
  name,
  short,
  count,
  pct: Math.round((count / SIGNAL_TOTAL) * 100),
}));

// ---- recent stage changes (8) ----
export const recentChanges = [
  { company: "Dow Polyurethanes", from: "monitor_for_exit", to: "in_market", source: "sec_filing", time: "2h ago" },
  { company: "Sachem", from: "monitor_for_exit", to: "in_market", source: "google_news", time: "Yesterday" },
  { company: "Invista Nylon 6,6", from: "in_market", to: "on_hold", source: "earnings_transcript", time: "Yesterday" },
  { company: "Mosaic Brazil Assets", from: "on_hold", to: "monitor_for_exit", source: "earnings_transcript", time: "1 Jun" },
  { company: "Cargill Deicing Salt", from: "in_market", to: "pulled", source: "google_news", time: "1 Jun" },
  { company: "GEON Performance Solutions", from: "monitor_for_exit", to: "in_market", source: "google_news", time: "31 May" },
  { company: "W.R. Grace Catalysts", from: "in_market", to: "monitor_for_exit", source: "rss_feed", time: "30 May" },
  { company: "Lummus Technology", from: "monitor_for_exit", to: "in_market", source: "google_news", time: "29 May" },
] as const;

// ---- 90-day activity heatmap ----
export interface HeatDay {
  date: string;
  count: number;
  stageChanges: number;
  newEntries: number;
  dow: number; // 0=Mon .. 6=Sun
}

export function buildHeatmap(): HeatDay[] {
  const out: HeatDay[] = [];
  // 90 days ending at ANCHOR
  for (let off = 89; off >= 0; off--) {
    const date = addDays(ANCHOR, -off);
    const d = new Date(date + "T12:00:00");
    const dow = (d.getDay() + 6) % 7; // Mon=0
    const weekend = dow >= 5;
    // deterministic "busy"/"quiet" week pattern
    const weekIdx = Math.floor((89 - off) / 7);
    const busyWeek = weekIdx % 4 === 1;
    const quietWeek = weekIdx % 4 === 3;
    let count: number;
    if (weekend) count = (off * 7) % 5 === 0 ? 1 : 0;
    else if (busyWeek) count = 4 + ((off * 13) % 4); // 4-7
    else if (quietWeek) count = (off * 5) % 2; // 0-1
    else count = 1 + ((off * 11) % 4); // 1-4
    const stageChanges = Math.round(count * 0.6);
    const newEntries = count - stageChanges;
    out.push({ date, count, stageChanges, newEntries, dow });
  }
  return out;
}

export const HEAT_SCALE = [
  { min: 0, color: "#F1EFE8" },
  { min: 1, color: "#B5D4F4" },
  { min: 3, color: "#5DA8EF" },
  { min: 5, color: "#185FA5" },
  { min: 7, color: "#0C447C" },
];

export function heatColor(count: number): string {
  if (count >= 7) return "#0C447C";
  if (count >= 5) return "#185FA5";
  if (count >= 3) return "#5DA8EF";
  if (count >= 1) return "#B5D4F4";
  return "#F1EFE8";
}
