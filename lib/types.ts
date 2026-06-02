// ---- enums ----
export type Sector =
  | "chemicals"
  | "industrials"
  | "agriculture"
  | "specialty_materials"
  | "energy_fuels"
  | "pharma_inputs"
  | "consumer_coatings";

export type DealType = "carveout" | "private_asset";

export type Stage = "in_market" | "monitor_for_exit" | "on_hold" | "pulled";

export type Confidence = "high" | "medium" | "low" | "needs_review";

export type SourceType =
  | "sec_filing"
  | "earnings_transcript"
  | "google_news"
  | "rss_feed"
  | "manual";

export type ChangedBy = "system_auto" | "analyst_manual";

export type FeedEventType =
  | "moved_in_market"
  | "moved_monitor"
  | "moved_on_hold"
  | "pulled"
  | "new_entry"
  | "flagged";

// ---- entities ----
export interface Company {
  id: string;
  name: string;
  sector: Sector;
  dealType: DealType;
  sponsorFirm?: string | null;
  parentCompany?: string | null;
  description: string;
  confidence: Confidence;
  currentStage: Stage;
  daysInStage: number;
  firstTracked: string; // ISO date
  lastUpdated: string; // ISO date
}

export interface StageHistoryRecord {
  id: string;
  companyId: string;
  stage: Stage;
  changedAt: string; // ISO date
  changedBy: ChangedBy;
  sourceType: SourceType;
  sourceUrl?: string | null;
  notes?: string | null;
}

export interface Signal {
  id: string;
  companyId: string;
  sourceType: SourceType;
  sourceUrl: string;
  title: string;
  excerpt: string;
  ingestedAt: string; // ISO date
}

export interface Note {
  id: string;
  companyId: string;
  author: string;
  initials: string;
  content: string;
  createdAt: string; // ISO date
}

export interface FeedEvent {
  id: string;
  type: FeedEventType;
  companyId: string;
  fromStage?: Stage | null;
  toStage?: Stage | null;
  action: string; // human-readable summary
  timestamp: string; // ISO datetime
  sourceType: SourceType;
  sourceUrl: string;
  excerpt?: string | null;
  flagged?: boolean;
}

export interface ReviewItem {
  companyId: string;
  reason: string; // why flagged
  conflictSummary: string;
}
