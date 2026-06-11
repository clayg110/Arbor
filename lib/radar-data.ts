import type { DealType, Sector, Confidence, Stage, SourceType } from "./types";
import type { OurProcessStage, ProcessKeyDates } from "./process-stage";
import { computeConviction, type Conviction } from "./conviction";

export interface LastSignal {
  label: string; // "2 days ago"
  sourceName: string; // "SEC 8-K"
  source: SourceType; // icon
  daysAgo: number; // for stale detection
}

export interface RadarCompany {
  id: string; // radar-local id
  companyId?: string; // profile link when a /company/[id] exists
  name: string;
  dealType: DealType;
  sector: Sector;
  confidence: Confidence;
  stage: Stage;
  pulled?: boolean; // sits in the on_hold column but is definitively pulled
  ownerName: string; // sponsor (private) or parent (carveout)
  days: number; // numeric days in stage (sort + data bar)
  stageNote?: string; // on_hold/pulled custom line
  added: string; // ISO (sort)
  addedDisplay: string; // "Mar 15 2026"
  lastSignal: LastSignal;
  quote?: string;
  watchlisted?: boolean;
  wasInMarket?: number; // for on_hold/pulled
  // §2.1/§2.2 additions (nullable — populated by ingestion / manual entry)
  subsector?: string | null;
  logoUrl?: string | null;
  revenue?: string | null;
  ebitda?: string | null;
  margin?: string | null;
  description?: string | null;
  revenueSource?: string | null;
  ebitdaSource?: string | null;
  conviction?: Conviction; // 0–100 "likely to transact" + band
  ourProcessStage?: OurProcessStage | null;
  processKeyDates?: ProcessKeyDates | null;
}

const sig = (
  label: string,
  sourceName: string,
  source: SourceType,
  daysAgo: number
): LastSignal => ({ label, sourceName, source, daysAgo });

export const baseRadarCompanies: RadarCompany[] = [
  // ---------------- IN MARKET ----------------
  {
    id: "r1",
    companyId: "1",
    name: "Dow Polyurethanes",
    dealType: "carveout",
    sector: "chemicals",
    confidence: "high",
    stage: "in_market",
    ownerName: "Dow Inc.",
    days: 47,
    added: "2026-03-15",
    addedDisplay: "Mar 15 2026",
    lastSignal: sig("2 days ago", "SEC 8-K", "sec_filing", 2),
    watchlisted: true,
    quote:
      "Goldman Sachs and Morgan Stanley engaged as advisors to explore strategic alternatives for the Polyurethanes segment.",
    ourProcessStage: "first_round_bid",
    processKeyDates: { first_round_bid: "2026-06-25" },
  },
  {
    id: "r2",
    companyId: "6",
    name: "Sachem",
    dealType: "private_asset",
    sector: "chemicals",
    confidence: "high",
    stage: "in_market",
    ownerName: "One Rock Capital Partners",
    days: 12,
    added: "2026-05-20",
    addedDisplay: "May 20 2026",
    lastSignal: sig("4 days ago", "Bloomberg", "google_news", 4),
    watchlisted: true,
    quote: "Sale process could value the business at more than $600 million.",
    ourProcessStage: "nda_signed",
  },
  {
    id: "r3",
    companyId: "2",
    name: "EPSilyte",
    dealType: "private_asset",
    sector: "chemicals",
    confidence: "high",
    stage: "in_market",
    ownerName: "INEOS Group",
    days: 7,
    added: "2026-05-26",
    addedDisplay: "May 26 2026",
    lastSignal: sig("1 day ago", "PE Wire", "google_news", 1),
    ourProcessStage: "cim_received",
  },
  {
    id: "r4",
    name: "Nouryon Surfactants",
    dealType: "private_asset",
    sector: "specialty_materials",
    confidence: "medium",
    stage: "in_market",
    ownerName: "Carlyle Group",
    days: 3,
    added: "2026-06-01",
    addedDisplay: "Jun 1 2026",
    lastSignal: sig("3 days ago", "PE Wire", "google_news", 3),
    quote:
      "Jefferies mandated to run formal sale process. Estimated deal size: $800M–$1.2B.",
    ourProcessStage: "watching",
  },
  {
    id: "r5",
    companyId: "5",
    name: "GEON Performance Solutions",
    dealType: "private_asset",
    sector: "chemicals",
    confidence: "high",
    stage: "in_market",
    ownerName: "West Street Capital Partners",
    days: 18,
    added: "2026-05-15",
    addedDisplay: "May 15 2026",
    lastSignal: sig("5 days ago", "PE Wire", "google_news", 5),
    watchlisted: true,
    quote:
      "Houlihan Lokey hired to run sale process. First round bids expected late Q3 2026.",
    ourProcessStage: "exclusivity",
    processKeyDates: { exclusivity: "2026-06-30" },
  },
  {
    id: "r6",
    companyId: "8",
    name: "Valudor Products",
    dealType: "private_asset",
    sector: "specialty_materials",
    confidence: "high",
    stage: "in_market",
    ownerName: "Undisclosed",
    days: 6,
    added: "2026-05-28",
    addedDisplay: "May 28 2026",
    lastSignal: sig("6 days ago", "Manual", "manual", 6),
  },
  {
    id: "r7",
    name: "Chroma",
    dealType: "private_asset",
    sector: "specialty_materials",
    confidence: "medium",
    stage: "in_market",
    ownerName: "Arsenal Capital Partners",
    days: 21,
    added: "2026-05-12",
    addedDisplay: "May 12 2026",
    lastSignal: sig("8 days ago", "Google News", "google_news", 8),
  },
  {
    id: "r8",
    name: "Drew Marine",
    dealType: "private_asset",
    sector: "industrials",
    confidence: "medium",
    stage: "in_market",
    ownerName: "H.I.G. Capital",
    days: 34,
    added: "2026-04-29",
    addedDisplay: "Apr 29 2026",
    lastSignal: sig("11 days ago", "Reuters", "google_news", 11),
  },

  // ---------------- MONITOR FOR EXIT ----------------
  {
    id: "r9",
    companyId: "3",
    name: "Celanese Infraserv",
    dealType: "carveout",
    sector: "industrials",
    confidence: "high",
    stage: "monitor_for_exit",
    ownerName: "Celanese Corporation",
    days: 240,
    added: "2025-10-03",
    addedDisplay: "Oct 3 2025",
    lastSignal: sig("3 weeks ago", "SEC 10-K", "sec_filing", 21),
  },
  {
    id: "r10",
    companyId: "4",
    name: "Mosaic Brazil Assets",
    dealType: "carveout",
    sector: "agriculture",
    confidence: "medium",
    stage: "monitor_for_exit",
    ownerName: "Mosaic Company",
    days: 150,
    added: "2026-01-08",
    addedDisplay: "Jan 8 2026",
    lastSignal: sig("2 days ago", "Earnings call", "earnings_transcript", 2),
    watchlisted: true,
    quote:
      "We remain open to the right transaction at the right value for our Brazilian distribution assets.",
  },
  {
    id: "r11",
    name: "Archroma",
    dealType: "private_asset",
    sector: "specialty_materials",
    confidence: "high",
    stage: "monitor_for_exit",
    ownerName: "SK Capital Partners",
    days: 1,
    added: "2026-06-02",
    addedDisplay: "Jun 2 2026",
    lastSignal: sig("1 day ago", "Reuters", "google_news", 1),
    watchlisted: true,
    quote: "SK Capital exploring exit options for Archroma, acquired in 2021.",
  },
  {
    id: "r12",
    name: "Hexion Versatic Acids",
    dealType: "carveout",
    sector: "chemicals",
    confidence: "needs_review",
    stage: "monitor_for_exit",
    ownerName: "Hexion Inc.",
    days: 90,
    added: "2026-03-03",
    addedDisplay: "Mar 3 2026",
    lastSignal: sig("3 days ago", "Mergermarket", "google_news", 3),
  },
  {
    id: "r13",
    name: "Innospec Fuel Specialties",
    dealType: "carveout",
    sector: "energy_fuels",
    confidence: "medium",
    stage: "monitor_for_exit",
    ownerName: "Innospec Inc.",
    days: 2,
    added: "2026-06-01",
    addedDisplay: "Jun 1 2026",
    lastSignal: sig("2 days ago", "SEC 10-K", "sec_filing", 2),
  },
  {
    id: "r14",
    companyId: "9",
    name: "Altivia",
    dealType: "private_asset",
    sector: "chemicals",
    confidence: "needs_review",
    stage: "monitor_for_exit",
    ownerName: "Undisclosed",
    days: 330,
    added: "2025-07-05",
    addedDisplay: "Jul 5 2025",
    lastSignal: sig("7 days ago", "Google News", "google_news", 7),
    watchlisted: true,
  },
  {
    id: "r15",
    companyId: "10",
    name: "Miraclon",
    dealType: "private_asset",
    sector: "industrials",
    confidence: "medium",
    stage: "monitor_for_exit",
    ownerName: "Montagu Private Equity",
    days: 120,
    added: "2026-02-02",
    addedDisplay: "Feb 2 2026",
    lastSignal: sig("5 days ago", "PE Wire", "google_news", 5),
  },
  {
    id: "r16",
    name: "Boulder Scientific Company",
    dealType: "private_asset",
    sector: "chemicals",
    confidence: "high",
    stage: "monitor_for_exit",
    ownerName: "Edgewater Capital",
    days: 180,
    added: "2025-12-01",
    addedDisplay: "Dec 1 2025",
    lastSignal: sig("2 weeks ago", "Google News", "google_news", 14),
  },

  // ---------------- ON HOLD / PULLED ----------------
  {
    id: "r17",
    companyId: "7",
    name: "Invista Nylon 6,6 Plants",
    dealType: "carveout",
    sector: "industrials",
    confidence: "high",
    stage: "on_hold",
    ownerName: "Koch Industries",
    days: 3,
    wasInMarket: 61,
    stageNote: "On hold · 3 days in stage · Was in market 61 days",
    added: "2026-05-31",
    addedDisplay: "May 31 2026",
    lastSignal: sig("1 day ago", "Earnings call", "earnings_transcript", 1),
    watchlisted: true,
    quote:
      "We have made the decision to pause the divestiture process and will reassess in H2 2026.",
  },
  {
    id: "r18",
    name: "Cargill Deicing Salt",
    dealType: "carveout",
    sector: "agriculture",
    confidence: "high",
    stage: "pulled",
    pulled: true,
    ownerName: "Cargill Inc.",
    days: 5,
    wasInMarket: 89,
    stageNote: "Pulled · 5 days ago · Was in market 89 days",
    added: "2026-05-30",
    addedDisplay: "May 30 2026",
    lastSignal: sig("5 days ago", "Press release", "google_news", 5),
    quote:
      "Cargill has determined deicing salt is a strong strategic fit and will not be divesting.",
  },
  {
    id: "r19",
    companyId: "11",
    name: "Shell Phenol Assets",
    dealType: "carveout",
    sector: "energy_fuels",
    confidence: "high",
    stage: "on_hold",
    ownerName: "Shell plc",
    days: 60,
    stageNote: "On hold · 2 months in stage",
    added: "2026-04-04",
    addedDisplay: "Apr 4 2026",
    lastSignal: sig("3 weeks ago", "Reuters", "google_news", 21),
  },
  {
    id: "r20",
    companyId: "12",
    name: "Braskem U.S. Assets",
    dealType: "carveout",
    sector: "chemicals",
    confidence: "high",
    stage: "on_hold",
    ownerName: "Braskem S.A.",
    days: 150,
    stageNote: "On hold · 5 months in stage",
    added: "2026-01-04",
    addedDisplay: "Jan 4 2026",
    lastSignal: sig("6 weeks ago", "SEC filing", "sec_filing", 42),
  },
  {
    id: "r21",
    name: "Isola Group",
    dealType: "private_asset",
    sector: "specialty_materials",
    confidence: "medium",
    stage: "on_hold",
    ownerName: "Investors",
    days: 90,
    stageNote: "On hold · 3 months in stage",
    added: "2026-03-04",
    addedDisplay: "Mar 4 2026",
    lastSignal: sig("1 month ago", "Google News", "google_news", 30),
  },
  {
    id: "r22",
    name: "TPC Group",
    dealType: "private_asset",
    sector: "chemicals",
    confidence: "high",
    stage: "pulled",
    pulled: true,
    ownerName: "First Reserve / SK Capital",
    days: 30,
    wasInMarket: 44,
    stageNote: "Pulled · 1 month ago · Was in market 44 days",
    added: "2026-05-04",
    addedDisplay: "May 4 2026",
    lastSignal: sig("1 month ago", "Bloomberg", "google_news", 30),
  },
  {
    id: "r23",
    name: "Syngenta non-Ag crop business",
    dealType: "carveout",
    sector: "agriculture",
    confidence: "medium",
    stage: "on_hold",
    ownerName: "Syngenta Group",
    days: 210,
    stageNote: "On hold · 7 months in stage",
    added: "2025-11-03",
    addedDisplay: "Nov 3 2025",
    lastSignal: sig("2 months ago", "SEC 20-F", "sec_filing", 60),
  },
  {
    id: "r24",
    name: "HF Sinclair Lubricants",
    dealType: "carveout",
    sector: "energy_fuels",
    confidence: "medium",
    stage: "on_hold",
    ownerName: "HF Sinclair Corporation",
    days: 120,
    stageNote: "On hold · 4 months in stage",
    added: "2026-02-04",
    addedDisplay: "Feb 4 2026",
    lastSignal: sig("5 weeks ago", "Earnings call", "earnings_transcript", 35),
  },
];

// Mock companies lack stored signal aggregates, so conviction is derived from the
// last-signal recency + confidence + stage (the live path enriches it with real
// 30-day signal counts via v_company_conviction).
export const radarCompanies: RadarCompany[] = baseRadarCompanies.map((c) => ({
  ...c,
  conviction: computeConviction({
    lastSignalAgeDays: c.lastSignal.daysAgo,
    confidence: c.confidence,
    stage: c.stage,
  }),
}));

// ---- summary strip (always unfiltered) ----
export const summaryStrip = {
  total: 1084,
  sectors: 7,
  inMarket: 247,
  monitor: 389,
  onHold: 448,
  needsReview: 12,
  newThisWeek: 8,
  newCarveout: 6,
  newPrivate: 2,
};

// ---- sector summary cards ----
export interface SectorSummary {
  key: Sector;
  label: string;
  total: number;
  inMarket: number;
  monitor: number;
  onHold: number;
}
export const sectorSummary: SectorSummary[] = [
  {
    key: "chemicals",
    label: "Chemicals",
    total: 312,
    inMarket: 68,
    monitor: 142,
    onHold: 102,
  },
  {
    key: "industrials",
    label: "Industrials",
    total: 198,
    inMarket: 42,
    monitor: 89,
    onHold: 67,
  },
  {
    key: "agriculture",
    label: "Agriculture",
    total: 143,
    inMarket: 38,
    monitor: 67,
    onHold: 38,
  },
  {
    key: "specialty_materials",
    label: "Specialty materials",
    total: 121,
    inMarket: 33,
    monitor: 52,
    onHold: 36,
  },
  {
    key: "energy_fuels",
    label: "Energy & fuels",
    total: 108,
    inMarket: 27,
    monitor: 48,
    onHold: 33,
  },
  {
    key: "pharma_inputs",
    label: "Pharma inputs",
    total: 92,
    inMarket: 21,
    monitor: 38,
    onHold: 33,
  },
  {
    key: "consumer_coatings",
    label: "Consumer & coatings",
    total: 110,
    inMarket: 18,
    monitor: 56,
    onHold: 36,
  },
];

export const MOST_ACTIVE_SECTOR: Sector = "chemicals";

// unique sponsor/parent names for the dropdown
export const sponsorOptions = Array.from(
  new Set(radarCompanies.map((c) => c.ownerName))
).sort();
