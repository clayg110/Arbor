// ============================================================================
// Database row types — mirror supabase/migrations/0001_init.sql + 0002.
// Hand-written (stand-in for `supabase gen types`). Regenerate later with:
//   supabase gen types typescript --project-id <id> > types/db.ts
//
// IMPORTANT: row shapes are declared with `type` (not `interface`) so they
// satisfy supabase-js's `Record<string, unknown>` constraint — interfaces lack
// an index signature and collapse Insert/Update to `never`.
// ============================================================================

import type { Sector, DealType, Stage, Confidence, SourceType } from "@/lib/types";

export type ChangedBy = "system_auto" | "analyst_manual";

export type DbFeedEvent =
  | "moved_in_market"
  | "moved_monitor"
  | "moved_on_hold"
  | "pulled"
  | "new_entry"
  | "flagged"
  | "confidence_update";

// ---- llm_output jsonb (signals_raw) — feed/review contract ----
export interface ConflictSide {
  source: string;
  text: string;
  stage: Stage;
}
export interface LlmOutput {
  event_type?: DbFeedEvent;
  headline?: string;
  stage?: Stage;
  confidence?: Confidence;
  key_quote?: string;
  attribution?: string;
  deal_size?: string;
  reasoning?: string;
  conflict?: { signalA: ConflictSide; signalB: ConflictSide };
  new_entry?: {
    owner_label: "Sponsor" | "Parent";
    owner_name: string;
    deal_size: string;
    reason: string;
  };
}

// ---- table rows ----
export type DbCompany = {
  id: string;
  name: string;
  sector: Sector;
  subsector: string | null;
  deal_type: DealType;
  sponsor_firm: string | null;
  parent_company: string | null;
  description: string | null;
  confidence: Confidence;
  current_stage: Stage;
  current_stage_since: string;
  logo_url: string | null;
  revenue: string | null;
  ebitda: string | null;
  margin: string | null;
  revenue_source_url: string | null;
  ebitda_source_url: string | null;
  created_at: string;
  updated_at: string;
  // outcome fields (migration 0026) — null until migration is applied
  outcome?: "closed" | "withdrawn" | null;
  acquirer?: string | null;
  close_multiple?: string | null;
  closed_at?: string | null;
  // deal workflow (migration 0030)
  owner_id?: string | null;
};

// Monitored company universe (Backend §2.1) — no deal stage.
export type DbUniverseCompany = {
  id: string;
  name: string;
  sector: string;
  subsector: string | null;
  last_scanned_at: string | null;
  created_at: string;
};
export type UniverseCountsRow = {
  sector: string;
  subsector: string | null;
  n: number;
};

export type DbSignal = {
  id: string;
  company_id: string | null;
  raw_text: string | null;
  source_url: string | null;
  source_type: SourceType | null;
  source_name: string | null;
  doc_type: string | null;
  ingested_at: string;
  processed: boolean;
  matched_company_id: string | null;
  llm_output: LlmOutput | null;
  dedupe_key?: string | null;
};

export type DbHistory = {
  id: string;
  company_id: string;
  signal_id: string | null;
  stage: Stage;
  event_type: DbFeedEvent | null;
  changed_at: string;
  changed_by: ChangedBy;
  source_type: SourceType | null;
  source_name: string | null;
  doc_type: string | null;
  source_url: string | null;
  headline: string | null;
  notes: string | null;
};

export type DbWatchlist = {
  id: string;
  user_id: string;
  company_id: string;
  org_id: string | null;
  created_at: string;
};

export type DbNote = {
  id: string;
  company_id: string;
  user_id: string;
  org_id: string | null;
  author: string | null;
  content: string;
  created_at: string;
};

export type DbCompanyMemo = {
  company_id: string;
  memo: string;
  signals_hash: string;
  model: string | null;
  generated_at: string;
};

export type DbAlertRule = {
  id: string;
  user_id: string;
  org_id: string | null;
  name: string;
  predicate: Record<string, unknown>;
  webhook: boolean;
  email_delivery: boolean;
  active: boolean;
  created_at: string;
};

// ---- deal workflow (0030) ----
export type DbDealTask = {
  id: string;
  company_id: string;
  user_id: string;
  org_id: string | null;
  title: string;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export type DbOutreachLog = {
  id: string;
  company_id: string;
  user_id: string;
  org_id: string | null;
  type: "call" | "email" | "meeting" | "other";
  note: string;
  contacted_at: string;
  created_at: string;
};

// ---- saved radar views (0029) ----
export type DbSavedView = {
  id: string;
  user_id: string;
  org_id: string | null;
  name: string;
  filters: Record<string, unknown>;
  created_at: string;
};

// ---- user preferences (0028 + 0033) ----
export type DbUserPreferences = {
  user_id: string;
  briefing_frequency: "off" | "daily" | "weekly";
  report_frequency: "off" | "weekly" | "monthly";
  updated_at: string;
};

// ---- analytics views (0032) ----
export type FunnelCohortRow = {
  cohort_month: string; // ISO date (first of month)
  stage: Stage;
  entries: number;
};

export type ValuationMultipleRow = {
  sector: Sector;
  deals: number;
  avg_multiple: number | null;
  median_multiple: number | null;
};

export type WinLossRow = {
  sector: Sector;
  confidence: Confidence;
  wins: number;
  losses: number;
};

// ---- multi-tenant + governance (0014) ----
export type DbOrg = {
  id: string;
  name: string;
  created_at: string;
  // billing (0016) — all nullable / defaulted; absent until Stripe is configured
  plan?: string;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  subscription_status?: string | null;
  seats?: number | null;
  current_period_end?: string | null;
  scim_token_hash?: string | null; // SCIM provisioning (0021)
};

export type DbAuditLog = {
  id: string;
  org_id: string | null;
  user_id: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type DbApiKey = {
  id: string;
  org_id: string;
  created_by: string | null;
  name: string;
  key_prefix: string;
  key_hash: string;
  scopes: string[];
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export type DbLlmUsage = {
  id: string;
  source_type: SourceType | null;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  created_at: string;
};

export type DbPipelineRun = {
  id: string;
  pipeline: string;
  ran_at: string;
  fetched: number;
  created: number;
  updated: number;
  flagged: number;
  errors: number;
  ok: boolean;
};
// Dead-letter: signals that could not be processed (extraction hard-failed or the
// extraction circuit was open). Retained for inspection / replay.
export type DbSignalFailure = {
  id: string;
  source_url: string | null;
  source_type: string | null;
  source_name: string | null;
  doc_type: string | null;
  raw_text: string | null;
  reason: string | null;
  created_at: string;
};
export type DbNotification = {
  id: string;
  user_id: string;
  org_id: string | null;
  type: string;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  dedupe_key: string | null;
  read_at: string | null;
  created_at: string;
};
export type PipelineLatestRow = {
  pipeline: string;
  ran_at: string;
  fetched: number;
  created: number;
  updated: number;
  flagged: number;
  errors: number;
  ok: boolean;
};

// ---- view rows (0002_analytics.sql) ----
export type LastSignalRow = {
  company_id: string;
  ingested_at: string;
  source_type: SourceType | null;
  source_name: string | null;
  doc_type: string | null;
  key_quote: string | null;
};
export type ConvictionRow = {
  company_id: string;
  signal_count_30d: number;
  distinct_source_types: number;
  last_signal_at: string | null;
};
export type SummaryCountsRow = {
  total: number;
  in_market: number;
  monitor: number;
  on_hold: number;
  needs_review: number;
  new_this_week: number;
  new_carveout: number;
  new_private: number;
};
export type SectorStageRow = {
  sector: Sector;
  in_market: number;
  monitor: number;
  on_hold: number;
  total: number;
};
export type DealSplitRow = { deal_type: DealType; value: number; pct: number };
export type ConfidenceDistRow = { confidence: Confidence; count: number; pct: number };
export type ExitFunnelRow = { stage: Stage; avg_days: number; n: number };
export type TopSectorRow = { sector: Sector; avg_days: number; n: number };
export type SponsorActivityRow = {
  sponsor: string;
  processes: number;
  top_sector: Sector;
};
export type SponsorHoldingRow = {
  sponsor: string;
  total_deals: number;
  market_count: number;
  avg_days_hold: number | null;
  exit_rate_pct: number;
  top_sector: Sector;
};
export type CalibrationRow = {
  confidence: Confidence;
  total: number;
  closed_count: number;
  lost_count: number;
  close_rate_pct: number;
};
export type SignalSourceRow = { source_type: SourceType; count: number; pct: number };
export type TransitionRateRow = {
  from_stage: Stage;
  to_stage: Stage;
  count: number;
  pct: number;
};

// ---- rpc return rows ----
export type VelocityRow = {
  week_start: string;
  carveout: number;
  private_asset: number;
  total: number;
};
export type HeatmapRow = {
  day: string;
  events: number;
  stage_changes: number;
  new_entries: number;
};
export type SummaryMetricsRow = {
  new_deals: number;
  stage_changes: number;
  avg_days_market: number;
  pulled: number;
  needs_review: number;
  avg_confidence: number;
};
export type EventCountsRow = {
  stage_changes: number;
  new_entries: number;
  pulled: number;
  flagged: number;
  confidence_updates: number;
};
export type RecentChangeRow = {
  id: string;
  company_id: string;
  name: string;
  from_stage: Stage | null;
  to_stage: Stage;
  source_type: SourceType | null;
  changed_at: string;
};

// ============================================================================
// Database type for the typed Supabase client (Layer 4).
// ============================================================================
type Rel = [];

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: DbCompany;
        Insert: Partial<DbCompany> & {
          name: string;
          sector: Sector;
          deal_type: DealType;
        };
        Update: Partial<DbCompany>;
        Relationships: Rel;
      };
      signals_raw: {
        Row: DbSignal;
        Insert: Partial<DbSignal>;
        Update: Partial<DbSignal>;
        Relationships: Rel;
      };
      deal_stage_history: {
        Row: DbHistory;
        Insert: Partial<DbHistory> & { company_id: string; stage: Stage };
        Update: Partial<DbHistory>;
        Relationships: Rel;
      };
      watchlist: {
        Row: DbWatchlist;
        Insert: Partial<DbWatchlist> & { user_id: string; company_id: string };
        Update: Partial<DbWatchlist>;
        Relationships: Rel;
      };
      analyst_notes: {
        Row: DbNote;
        Insert: Partial<DbNote> & {
          company_id: string;
          user_id: string;
          content: string;
        };
        Update: Partial<DbNote>;
        Relationships: Rel;
      };
      company_memos: {
        Row: DbCompanyMemo;
        Insert: Partial<DbCompanyMemo> & {
          company_id: string;
          memo: string;
          signals_hash: string;
        };
        Update: Partial<DbCompanyMemo>;
        Relationships: Rel;
      };
      alert_rules: {
        Row: DbAlertRule;
        Insert: Partial<DbAlertRule> & { user_id: string; name: string };
        Update: Partial<DbAlertRule>;
        Relationships: Rel;
      };
      llm_usage: {
        Row: DbLlmUsage;
        Insert: Partial<DbLlmUsage>;
        Update: Partial<DbLlmUsage>;
        Relationships: Rel;
      };
      pipeline_runs: {
        Row: DbPipelineRun;
        Insert: Partial<DbPipelineRun> & { pipeline: string };
        Update: Partial<DbPipelineRun>;
        Relationships: Rel;
      };
      signal_failures: {
        Row: DbSignalFailure;
        Insert: Partial<DbSignalFailure>;
        Update: Partial<DbSignalFailure>;
        Relationships: Rel;
      };
      notifications: {
        Row: DbNotification;
        Insert: Partial<DbNotification> & {
          user_id: string;
          type: string;
          title: string;
        };
        Update: Partial<DbNotification>;
        Relationships: Rel;
      };
      universe_companies: {
        Row: DbUniverseCompany;
        Insert: Partial<DbUniverseCompany> & { name: string; sector: string };
        Update: Partial<DbUniverseCompany>;
        Relationships: Rel;
      };
      orgs: {
        Row: DbOrg;
        Insert: Partial<DbOrg> & { name: string };
        Update: Partial<DbOrg>;
        Relationships: Rel;
      };
      audit_log: {
        Row: DbAuditLog;
        Insert: Partial<DbAuditLog> & { action: string };
        Update: Partial<DbAuditLog>;
        Relationships: Rel;
      };
      api_keys: {
        Row: DbApiKey;
        Insert: Partial<DbApiKey> & {
          org_id: string;
          name: string;
          key_prefix: string;
          key_hash: string;
        };
        Update: Partial<DbApiKey>;
        Relationships: Rel;
      };
      user_preferences: {
        Row: DbUserPreferences;
        Insert: Partial<DbUserPreferences> & { user_id: string };
        Update: Partial<DbUserPreferences>;
        Relationships: Rel;
      };
      saved_views: {
        Row: DbSavedView;
        Insert: Partial<DbSavedView> & {
          user_id: string;
          name: string;
          filters: Record<string, unknown>;
        };
        Update: Partial<DbSavedView>;
        Relationships: Rel;
      };
      deal_tasks: {
        Row: DbDealTask;
        Insert: Partial<DbDealTask> & {
          company_id: string;
          user_id: string;
          title: string;
        };
        Update: Partial<DbDealTask>;
        Relationships: Rel;
      };
      outreach_log: {
        Row: DbOutreachLog;
        Insert: Partial<DbOutreachLog> & {
          company_id: string;
          user_id: string;
          type: DbOutreachLog["type"];
          note: string;
        };
        Update: Partial<DbOutreachLog>;
        Relationships: Rel;
      };
    };
    Views: {
      v_company_last_signal: { Row: LastSignalRow; Relationships: Rel };
      v_company_conviction: { Row: ConvictionRow; Relationships: Rel };
      v_pipeline_latest: { Row: PipelineLatestRow; Relationships: Rel };
      v_universe_counts: { Row: UniverseCountsRow; Relationships: Rel };
      v_summary_counts: { Row: SummaryCountsRow; Relationships: Rel };
      v_sector_stage: { Row: SectorStageRow; Relationships: Rel };
      v_deal_split: { Row: DealSplitRow; Relationships: Rel };
      v_confidence_dist: { Row: ConfidenceDistRow; Relationships: Rel };
      v_exit_funnel: { Row: ExitFunnelRow; Relationships: Rel };
      v_top_sectors: { Row: TopSectorRow; Relationships: Rel };
      v_sponsor_activity: { Row: SponsorActivityRow; Relationships: Rel };
      v_sponsor_holding: { Row: SponsorHoldingRow; Relationships: Rel };
      v_confidence_calibration: { Row: CalibrationRow; Relationships: Rel };
      v_signal_sources: { Row: SignalSourceRow; Relationships: Rel };
      v_transition_rates: { Row: TransitionRateRow; Relationships: Rel };
      v_recent_changes: { Row: RecentChangeRow; Relationships: Rel };
      v_funnel_cohorts: { Row: FunnelCohortRow; Relationships: Rel };
      v_valuation_multiples: { Row: ValuationMultipleRow; Relationships: Rel };
      v_win_loss: { Row: WinLossRow; Relationships: Rel };
    };
    Functions: {
      rpc_velocity: { Args: { p_from?: string; p_to?: string }; Returns: VelocityRow[] };
      rpc_heatmap: { Args: { p_from?: string; p_to?: string }; Returns: HeatmapRow[] };
      rpc_summary_metrics: {
        Args: { p_from?: string; p_to?: string };
        Returns: SummaryMetricsRow[];
      };
      rpc_event_counts: {
        Args: { p_from?: string; p_to?: string };
        Returns: EventCountsRow[];
      };
      rpc_apply_stage: {
        Args: {
          p_company_id: string;
          p_stage: Stage;
          p_confidence?: Confidence;
          p_changed_by?: ChangedBy;
          p_source_type?: SourceType;
          p_notes?: string;
        };
        Returns: DbHistory;
      };
    };
    Enums: {
      sector_enum: Sector;
      deal_type_enum: DealType;
      stage_enum: Stage;
      confidence_enum: Confidence;
      changed_by_enum: ChangedBy;
      source_type_enum: SourceType;
      feed_event_enum: DbFeedEvent;
    };
    CompositeTypes: Record<string, never>;
  };
}
