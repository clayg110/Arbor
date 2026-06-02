import type { DealType, Sector, Confidence, Stage, SourceType } from "./types";

// Self-contained data for the enhanced /feed page. Kept separate from
// lib/mock-data.ts so the other pages are unaffected.

export type FeedItemType =
  | "to_in_market"
  | "to_monitor"
  | "to_on_hold"
  | "pulled"
  | "new_entry"
  | "flagged"
  | "confidence_update";

export type DayKey = "today" | "yesterday" | "d2" | "d3";

export const DAY_LABELS: Record<DayKey, string> = {
  today: "Today — Tuesday, 3 June 2026",
  yesterday: "Yesterday — Monday, 2 June 2026",
  d2: "Sunday, 1 June 2026",
  d3: "Saturday, 31 May 2026",
};

export const DAY_ORDER: DayKey[] = ["today", "yesterday", "d2", "d3"];

export interface FeedSource {
  sourceType: SourceType; // selects the zone-4 icon
  name: string; // "SEC EDGAR"
  docType: string; // "8-K filing"
}

export interface QuoteContent {
  kind: "quote";
  text: string;
  attribution: string;
}
export interface ConflictSignal {
  source: string;
  text: string;
  stage: Stage;
}
export interface ConflictContent {
  kind: "conflict";
  signalA: ConflictSignal;
  signalB: ConflictSignal;
}
export interface NewEntryContent {
  kind: "new_entry";
  ownerLabel: "Sponsor" | "Parent";
  ownerName: string;
  sectorLabel: string;
  dealSize: string;
  reason: string;
}
export interface NoteContent {
  kind: "note";
  text: string;
}
export type ExpandedContent =
  | QuoteContent
  | ConflictContent
  | NewEntryContent
  | NoteContent;

export interface FeedItem {
  id: string;
  type: FeedItemType;
  day: DayKey;
  companyId?: string; // present only when a real profile exists
  company: string;
  dealType: DealType;
  sector: Sector;
  confidence: Confidence;
  stage: Stage; // new / current stage shown in the badge row
  headline: string; // muted action text after the company name
  source: FeedSource;
  sourceUrl: string;
  timeLabel: string;
  expanded?: ExpandedContent;
}

export const feedItems: FeedItem[] = [
  // ---------- TODAY ----------
  {
    id: "f1",
    type: "to_in_market",
    day: "today",
    companyId: "1",
    company: "Dow Polyurethanes",
    dealType: "carveout",
    sector: "chemicals",
    confidence: "high",
    stage: "in_market",
    headline: "moved from monitor for exit to in market",
    source: { sourceType: "sec_filing", name: "SEC EDGAR", docType: "8-K filing" },
    sourceUrl: "#",
    timeLabel: "2 hours ago",
    expanded: {
      kind: "quote",
      text: "The Company has engaged Goldman Sachs and Morgan Stanley as financial advisors to assist in the evaluation of strategic alternatives for its Polyurethanes segment, which may include a sale or spin-off of the business.",
      attribution: "Dow Inc. Form 8-K, 3 Jun 2026",
    },
  },
  {
    id: "f2",
    type: "new_entry",
    day: "today",
    company: "Nouryon Surfactants",
    dealType: "private_asset",
    sector: "specialty_materials",
    confidence: "medium",
    stage: "in_market",
    headline: "added to tracker — private asset, Specialty materials",
    source: { sourceType: "google_news", name: "PE Wire", docType: "Deal brief" },
    sourceUrl: "#",
    timeLabel: "5 hours ago",
    expanded: {
      kind: "new_entry",
      ownerLabel: "Sponsor",
      ownerName: "Carlyle Group",
      sectorLabel: "Specialty materials",
      dealSize: "$800M–$1.2B",
      reason:
        "Added following PE Wire report that Carlyle Group has mandated Jefferies to run a formal sale process for Nouryon's surfactants division.",
    },
  },
  {
    id: "f3",
    type: "flagged",
    day: "today",
    companyId: "9",
    company: "Altivia",
    dealType: "private_asset",
    sector: "chemicals",
    confidence: "needs_review",
    stage: "in_market",
    headline: "flagged for analyst review — conflicting signals detected",
    source: {
      sourceType: "google_news",
      name: "Google News",
      docType: "Two conflicting articles",
    },
    sourceUrl: "#",
    timeLabel: "7 hours ago",
    expanded: {
      kind: "conflict",
      signalA: {
        source: "Reuters, 28 May",
        text: "in active sale process with three strategic bidders.",
        stage: "in_market",
      },
      signalB: {
        source: "Chemical Week, 30 May",
        text: "process paused amid feedstock pricing concerns.",
        stage: "on_hold",
      },
    },
  },

  // ---------- YESTERDAY ----------
  {
    id: "f4",
    type: "to_in_market",
    day: "yesterday",
    companyId: "6",
    company: "Sachem",
    dealType: "private_asset",
    sector: "chemicals",
    confidence: "high",
    stage: "in_market",
    headline: "moved from monitor for exit to in market",
    source: {
      sourceType: "google_news",
      name: "Bloomberg M&A",
      docType: "News article",
    },
    sourceUrl: "#",
    timeLabel: "Yesterday, 4:12 pm",
    expanded: {
      kind: "quote",
      text: "Sachem Inc., the Austin-based specialty chemicals maker backed by One Rock Capital, has kicked off a sale process that could value the business at more than $600 million, according to people familiar with the matter.",
      attribution: "Bloomberg M&A, 2 Jun 2026",
    },
  },
  {
    id: "f5",
    type: "to_on_hold",
    day: "yesterday",
    companyId: "7",
    company: "Invista Nylon 6,6 Plants",
    dealType: "carveout",
    sector: "industrials",
    confidence: "high",
    stage: "on_hold",
    headline: "process placed on hold by Koch Industries",
    source: {
      sourceType: "earnings_transcript",
      name: "Koch Industries Q1 2026 earnings call",
      docType: "Transcript",
    },
    sourceUrl: "#",
    timeLabel: "Yesterday, 11:05 am",
    expanded: {
      kind: "quote",
      text: "Given the current macroeconomic environment and the disconnect between buyer and seller valuation expectations, we have made the decision to pause the divestiture process for the Nylon 6,6 assets and will reassess in the second half of 2026.",
      attribution: "Koch Industries Q1 2026 Earnings Call, 2 Jun 2026",
    },
  },
  {
    id: "f6",
    type: "new_entry",
    day: "yesterday",
    company: "Archroma",
    dealType: "private_asset",
    sector: "specialty_materials",
    confidence: "high",
    stage: "monitor_for_exit",
    headline: "added to tracker — private asset, Specialty materials",
    source: {
      sourceType: "google_news",
      name: "Reuters M&A",
      docType: "News article",
    },
    sourceUrl: "#",
    timeLabel: "Yesterday, 9:30 am",
    expanded: {
      kind: "new_entry",
      ownerLabel: "Sponsor",
      ownerName: "SK Capital Partners",
      sectorLabel: "Specialty materials",
      dealSize: "Undisclosed",
      reason:
        "Added following Reuters report that SK Capital is exploring exit options for Archroma, the textile and paper chemicals company acquired in 2021. No formal process launched yet.",
    },
  },
  {
    id: "f7",
    type: "confidence_update",
    day: "yesterday",
    companyId: "8",
    company: "Valudor Products",
    dealType: "private_asset",
    sector: "specialty_materials",
    confidence: "high",
    stage: "in_market",
    headline: "confidence updated from needs review to high",
    source: { sourceType: "manual", name: "Manual", docType: "Analyst review" },
    sourceUrl: "#",
    timeLabel: "Yesterday, 8:15 am",
    expanded: {
      kind: "note",
      text: "Confirmed in market following direct outreach. Sale process confirmed by company representative.",
    },
  },

  // ---------- TWO DAYS AGO ----------
  {
    id: "f8",
    type: "pulled",
    day: "d2",
    company: "Cargill Deicing Salt",
    dealType: "carveout",
    sector: "agriculture",
    confidence: "high",
    stage: "pulled",
    headline: "pulled from process — asset retained by Cargill",
    source: {
      sourceType: "google_news",
      name: "Cargill",
      docType: "Press release",
    },
    sourceUrl: "#",
    timeLabel: "2 days ago, 3:44 pm",
    expanded: {
      kind: "quote",
      text: "After a thorough review of strategic alternatives, Cargill has determined that its deicing salt business is a strong strategic fit within its broader portfolio and will not be divesting this asset at this time.",
      attribution: "Cargill Press Release, 1 Jun 2026",
    },
  },
  {
    id: "f9",
    type: "to_monitor",
    day: "d2",
    companyId: "4",
    company: "Mosaic Brazil Assets",
    dealType: "carveout",
    sector: "agriculture",
    confidence: "medium",
    stage: "monitor_for_exit",
    headline: "moved from on hold to monitor for exit",
    source: {
      sourceType: "earnings_transcript",
      name: "Mosaic Co. Q1 2026 earnings call",
      docType: "Transcript",
    },
    sourceUrl: "#",
    timeLabel: "2 days ago, 1:20 pm",
    expanded: {
      kind: "quote",
      text: "We continue to evaluate options for our Brazilian distribution assets. While no formal process is underway, we remain open to the right transaction at the right value.",
      attribution: "The Mosaic Company Q1 2026 Earnings Call, 1 Jun 2026",
    },
  },
  {
    id: "f10",
    type: "new_entry",
    day: "d2",
    company: "Innospec Fuel Specialties",
    dealType: "carveout",
    sector: "energy_fuels",
    confidence: "medium",
    stage: "monitor_for_exit",
    headline: "added to tracker — carveout, Energy & fuels",
    source: {
      sourceType: "sec_filing",
      name: "SEC EDGAR",
      docType: "10-K filing",
    },
    sourceUrl: "#",
    timeLabel: "2 days ago, 10:05 am",
    expanded: {
      kind: "new_entry",
      ownerLabel: "Parent",
      ownerName: "Innospec Inc.",
      sectorLabel: "Energy & fuels",
      dealSize: "Undisclosed",
      reason:
        "Added following language in Innospec's annual report indicating the Fuel Specialties segment is under strategic review. No banker mandate confirmed yet.",
    },
  },

  // ---------- THREE DAYS AGO ----------
  {
    id: "f11",
    type: "to_in_market",
    day: "d3",
    companyId: "5",
    company: "GEON Performance Solutions",
    dealType: "private_asset",
    sector: "chemicals",
    confidence: "high",
    stage: "in_market",
    headline: "moved from monitor for exit to in market",
    source: { sourceType: "google_news", name: "PE Wire", docType: "Deal brief" },
    sourceUrl: "#",
    timeLabel: "3 days ago, 2:30 pm",
    expanded: {
      kind: "quote",
      text: "West Street Capital Partners has hired Houlihan Lokey to run a sale process for GEON Performance Solutions, the PVC compounding business spun out of PolyOne in 2019. First round bids are expected in late Q3 2026.",
      attribution: "PE Wire Deal Brief, 31 May 2026",
    },
  },
  {
    id: "f12",
    type: "flagged",
    day: "d3",
    company: "Hexion Versatic Acids",
    dealType: "carveout",
    sector: "chemicals",
    confidence: "needs_review",
    stage: "in_market",
    headline: "flagged for analyst review — conflicting signals detected",
    source: {
      sourceType: "google_news",
      name: "Google News",
      docType: "Two conflicting articles",
    },
    sourceUrl: "#",
    timeLabel: "3 days ago, 11:00 am",
    expanded: {
      kind: "conflict",
      signalA: {
        source: "Mergermarket, 1 June",
        text: "process ongoing with four financial sponsors in second round.",
        stage: "in_market",
      },
      signalB: {
        source: "Hexion IR statement, 2 June",
        text: "we do not comment on market speculation regarding portfolio decisions.",
        stage: "on_hold",
      },
    },
  },
];

// ---- sidebar: initial watchlist ----
export interface WatchEntry {
  name: string;
  companyId?: string;
  stage: Stage;
  eventToday: boolean;
}

export const initialWatchlist: WatchEntry[] = [
  { name: "Dow Polyurethanes", companyId: "1", stage: "in_market", eventToday: true },
  { name: "Invista Nylon 6,6", companyId: "7", stage: "on_hold", eventToday: true },
  { name: "Mosaic Brazil Assets", companyId: "4", stage: "monitor_for_exit", eventToday: true },
  { name: "GEON Performance Solutions", companyId: "5", stage: "in_market", eventToday: false },
  { name: "Sachem", companyId: "6", stage: "in_market", eventToday: false },
];

// ---- sidebar: this week ----
export const weekStats = {
  range: "2–6 Jun",
  rows: [
    { label: "Stage changes", count: 14, color: "#185FA5" },
    { label: "New entries", count: 6, color: "#27500A" },
    { label: "Pulled / lapsed", count: 2, color: "#E24B4A" },
    { label: "Flagged for review", count: 3, color: "#BA7517" },
    { label: "Confidence updates", count: 4, color: "#9A9890" },
  ],
};

export const weekDistribution = [
  { day: "Mon", count: 7, today: false },
  { day: "Tue", count: 6, today: true },
  { day: "Wed", count: 4, today: false },
  { day: "Thu", count: 5, today: false },
  { day: "Fri", count: 3, today: false },
];

export const sectorsActive = [
  { label: "Chemicals", count: 8 },
  { label: "Specialty materials", count: 5 },
  { label: "Industrials", count: 4 },
  { label: "Agriculture", count: 3 },
  { label: "Energy & fuels", count: 2 },
];

export const liveStatus = { newToday: 6, yesterday: 7, updatedAgo: "4 min ago" };
