-- ============================================================================
-- Arbor — Layer 1: core schema
-- Tables, enums, indexes, triggers, realtime, RLS.
-- Idempotent: safe to re-run. Apply via Supabase SQL editor or `supabase db push`.
-- Shapes chosen to match the frontend data contracts in lib/*-data.ts.
-- ============================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
do $$ begin
  create type sector_enum as enum (
    'chemicals', 'industrials', 'agriculture', 'specialty_materials',
    'energy_fuels', 'pharma_inputs', 'consumer_coatings'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type deal_type_enum as enum ('carveout', 'private_asset');
exception when duplicate_object then null; end $$;

do $$ begin
  create type stage_enum as enum ('in_market', 'monitor_for_exit', 'on_hold', 'pulled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type confidence_enum as enum ('high', 'medium', 'low', 'needs_review');
exception when duplicate_object then null; end $$;

do $$ begin
  create type changed_by_enum as enum ('system_auto', 'analyst_manual');
exception when duplicate_object then null; end $$;

do $$ begin
  create type source_type_enum as enum (
    'sec_filing', 'earnings_transcript', 'google_news', 'rss_feed', 'manual'
  );
exception when duplicate_object then null; end $$;

-- Feed event taxonomy (maps to FeedItemType in lib/feed-data.ts)
do $$ begin
  create type feed_event_enum as enum (
    'moved_in_market', 'moved_monitor', 'moved_on_hold',
    'pulled', 'new_entry', 'flagged', 'confidence_update'
  );
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- companies  (→ RadarCompany, CompanyProfile, summary strip, analytics)
-- ----------------------------------------------------------------------------
create table if not exists public.companies (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  sector              sector_enum not null,
  deal_type           deal_type_enum not null,
  sponsor_firm        text,            -- private_asset owner
  parent_company      text,            -- carveout owner
  description         text,
  confidence          confidence_enum not null default 'needs_review',
  current_stage       stage_enum not null default 'in_market',
  current_stage_since timestamptz not null default now(),  -- → daysInStage
  created_at          timestamptz not null default now(),  -- → firstTracked
  updated_at          timestamptz not null default now()   -- → lastUpdated
);

create index if not exists idx_companies_sector on public.companies (sector);
create index if not exists idx_companies_deal_type on public.companies (deal_type);
create index if not exists idx_companies_stage on public.companies (current_stage);
create index if not exists idx_companies_confidence on public.companies (confidence);
create index if not exists idx_companies_stage_since on public.companies (current_stage_since);
create index if not exists idx_companies_created on public.companies (created_at desc);

-- ----------------------------------------------------------------------------
-- signals_raw  (audit trail + LLM output; powers feed quote/conflict/new-entry)
-- ----------------------------------------------------------------------------
create table if not exists public.signals_raw (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid references public.companies(id) on delete set null,
  raw_text           text,
  source_url         text,
  source_type        source_type_enum,
  source_name        text,             -- "SEC EDGAR", "Bloomberg M&A", ...
  doc_type           text,             -- "8-K filing", "Transcript", ...
  ingested_at        timestamptz not null default now(),
  processed          boolean not null default false,
  matched_company_id uuid,
  -- Structured extraction. Shape (keep stable — feed/review depend on it):
  -- {
  --   "event_type":   "moved_in_market" | "new_entry" | "flagged" | ...,
  --   "headline":     "moved from monitor for exit to in market",
  --   "stage":        "in_market",
  --   "confidence":   "high",
  --   "key_quote":    "...",
  --   "attribution":  "Dow Inc. Form 8-K, 3 Jun 2026",
  --   "conflict":     { "signalA": {"source","text","stage"},
  --                     "signalB": {"source","text","stage"} },
  --   "new_entry":    { "owner_label","owner_name","deal_size","reason" },
  --   "deal_size":    "$800M–$1.2B",
  --   "reasoning":    "..."
  -- }
  llm_output         jsonb
);

create index if not exists idx_signals_company on public.signals_raw (company_id);
create index if not exists idx_signals_ingested on public.signals_raw (ingested_at desc);
create index if not exists idx_signals_source on public.signals_raw (source_type);

-- ----------------------------------------------------------------------------
-- deal_stage_history  (→ FeedItem, StageTimeline, velocity/heatmap)
-- ----------------------------------------------------------------------------
create table if not exists public.deal_stage_history (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  signal_id    uuid references public.signals_raw(id) on delete set null,
  stage        stage_enum not null,
  event_type   feed_event_enum,
  changed_at   timestamptz not null default now(),
  changed_by   changed_by_enum not null default 'system_auto',
  source_type  source_type_enum,
  source_name  text,
  doc_type     text,
  source_url   text,
  headline     text,
  notes        text
);

create index if not exists idx_history_company on public.deal_stage_history (company_id);
create index if not exists idx_history_changed on public.deal_stage_history (changed_at desc);
create index if not exists idx_history_event on public.deal_stage_history (event_type);
create index if not exists idx_history_signal on public.deal_stage_history (signal_id);

-- ----------------------------------------------------------------------------
-- watchlist  (per-user)
-- ----------------------------------------------------------------------------
create table if not exists public.watchlist (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, company_id)
);
create index if not exists idx_watchlist_user on public.watchlist (user_id);
create index if not exists idx_watchlist_company on public.watchlist (company_id);

-- ----------------------------------------------------------------------------
-- analyst_notes
-- ----------------------------------------------------------------------------
create table if not exists public.analyst_notes (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  author     text,            -- display name snapshot
  content    text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_notes_company on public.analyst_notes (company_id);
create index if not exists idx_notes_user on public.analyst_notes (user_id);

-- ----------------------------------------------------------------------------
-- llm_usage  (cost tracking)
-- ----------------------------------------------------------------------------
create table if not exists public.llm_usage (
  id            uuid primary key default gen_random_uuid(),
  source_type   source_type_enum,
  model         text,
  input_tokens  integer,
  output_tokens integer,
  cost_usd      numeric(10,4),
  created_at    timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Triggers
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_companies_updated_at on public.companies;
create trigger trg_companies_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

-- Keep current_stage_since accurate whenever stage changes.
create or replace function public.bump_stage_since()
returns trigger language plpgsql as $$
begin
  if new.current_stage is distinct from old.current_stage then
    new.current_stage_since = now();
  end if;
  return new;
end $$;

drop trigger if exists trg_companies_stage_since on public.companies;
create trigger trg_companies_stage_since
  before update on public.companies
  for each row execute function public.bump_stage_since();

-- ----------------------------------------------------------------------------
-- Realtime
-- ----------------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table public.companies;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.deal_stage_history;
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- Row Level Security
--   Shared intelligence is readable by any authenticated user (also required
--   for realtime to push). Writes to shared tables come from the service role
--   (pipelines) or authenticated analysts (stage overrides / notes).
-- ----------------------------------------------------------------------------
alter table public.companies          enable row level security;
alter table public.signals_raw        enable row level security;
alter table public.deal_stage_history enable row level security;
alter table public.watchlist          enable row level security;
alter table public.analyst_notes      enable row level security;
alter table public.llm_usage          enable row level security;

-- companies
drop policy if exists "companies_read" on public.companies;
create policy "companies_read" on public.companies
  for select to authenticated using (true);

drop policy if exists "companies_update" on public.companies;
create policy "companies_update" on public.companies
  for update to authenticated using (true) with check (true);

-- signals_raw (read-only to clients; writes via service role)
drop policy if exists "signals_read" on public.signals_raw;
create policy "signals_read" on public.signals_raw
  for select to authenticated using (true);

-- deal_stage_history (read all; analysts may insert override rows)
drop policy if exists "history_read" on public.deal_stage_history;
create policy "history_read" on public.deal_stage_history
  for select to authenticated using (true);

drop policy if exists "history_insert" on public.deal_stage_history;
create policy "history_insert" on public.deal_stage_history
  for insert to authenticated with check (true);

-- watchlist (owner only) — auth.uid() in a subselect (evaluated once per query)
drop policy if exists "watchlist_rw" on public.watchlist;
create policy "watchlist_rw" on public.watchlist
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- analyst_notes (read all, write own)
drop policy if exists "notes_read" on public.analyst_notes;
create policy "notes_read" on public.analyst_notes
  for select to authenticated using (true);

-- writes are command-specific so SELECT stays single-policy (notes_read only)
drop policy if exists "notes_write" on public.analyst_notes;
create policy "notes_insert" on public.analyst_notes
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "notes_update" on public.analyst_notes
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "notes_delete" on public.analyst_notes
  for delete to authenticated using ((select auth.uid()) = user_id);

-- llm_usage (read by authenticated for admin panel; writes via service role)
drop policy if exists "usage_read" on public.llm_usage;
create policy "usage_read" on public.llm_usage
  for select to authenticated using (true);
