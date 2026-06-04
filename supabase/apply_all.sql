-- Arbor — full apply: migrations 0001-0004 + seed. Paste into Supabase SQL editor and Run.

-- ============================================================
-- migrations/0001_init.sql
-- ============================================================
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

-- watchlist (owner only)
drop policy if exists "watchlist_rw" on public.watchlist;
create policy "watchlist_rw" on public.watchlist
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- analyst_notes (read all, write own)
drop policy if exists "notes_read" on public.analyst_notes;
create policy "notes_read" on public.analyst_notes
  for select to authenticated using (true);

drop policy if exists "notes_write" on public.analyst_notes;
create policy "notes_write" on public.analyst_notes
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- llm_usage (read by authenticated for admin panel; writes via service role)
drop policy if exists "usage_read" on public.llm_usage;
create policy "usage_read" on public.llm_usage
  for select to authenticated using (true);

-- ============================================================
-- migrations/0002_analytics.sql
-- ============================================================
-- ============================================================================
-- Arbor — Layer 1: aggregation views, analytics RPCs, atomic stage update
-- Feeds /analytics, /radar summary strip + sector cards, and the stage-update
-- API route. Idempotent (create or replace). Apply after 0001_init.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Latest signal per company  (→ radar card "Last signal: 2 days ago (SEC 8-K)")
-- ----------------------------------------------------------------------------
create or replace view public.v_company_last_signal as
select distinct on (company_id)
  company_id,
  ingested_at,
  source_type,
  source_name,
  doc_type,
  llm_output ->> 'key_quote' as key_quote
from public.signals_raw
where company_id is not null
order by company_id, ingested_at desc;

-- ----------------------------------------------------------------------------
-- Summary strip counts  (→ /radar SECTION 2). Snapshot, unfiltered.
-- ----------------------------------------------------------------------------
create or replace view public.v_summary_counts as
select
  count(*)::int                                                              as total,
  count(*) filter (where current_stage = 'in_market')::int                  as in_market,
  count(*) filter (where current_stage = 'monitor_for_exit')::int           as monitor,
  count(*) filter (where current_stage in ('on_hold','pulled'))::int        as on_hold,
  count(*) filter (where confidence = 'needs_review')::int                  as needs_review,
  count(*) filter (where created_at >= now() - interval '7 days')::int      as new_this_week,
  count(*) filter (where created_at >= now() - interval '7 days'
                     and deal_type = 'carveout')::int                       as new_carveout,
  count(*) filter (where created_at >= now() - interval '7 days'
                     and deal_type = 'private_asset')::int                  as new_private
from public.companies;

-- ----------------------------------------------------------------------------
-- Stage distribution by sector  (→ analytics stacked bar + radar sector cards)
-- ----------------------------------------------------------------------------
create or replace view public.v_sector_stage as
select
  sector,
  count(*) filter (where current_stage = 'in_market')::int            as in_market,
  count(*) filter (where current_stage = 'monitor_for_exit')::int     as monitor,
  count(*) filter (where current_stage in ('on_hold','pulled'))::int  as on_hold,
  count(*)::int                                                       as total
from public.companies
group by sector;

-- ----------------------------------------------------------------------------
-- Deal-type split  (→ analytics doughnut)
-- ----------------------------------------------------------------------------
create or replace view public.v_deal_split as
select
  deal_type,
  count(*)::int                                              as value,
  round(100.0 * count(*) / nullif(sum(count(*)) over (), 0))::int as pct
from public.companies
group by deal_type;

-- ----------------------------------------------------------------------------
-- Confidence distribution  (→ analytics confidence bar)
-- ----------------------------------------------------------------------------
create or replace view public.v_confidence_dist as
select
  confidence,
  count(*)::int                                              as count,
  round(100.0 * count(*) / nullif(sum(count(*)) over (), 0))::int as pct
from public.companies
group by confidence;

-- ----------------------------------------------------------------------------
-- Exit funnel — avg days per current stage  (→ analytics funnel)
-- ----------------------------------------------------------------------------
create or replace view public.v_exit_funnel as
select
  current_stage as stage,
  round(avg(extract(epoch from now() - current_stage_since) / 86400.0))::int as avg_days,
  count(*)::int as n
from public.companies
group by current_stage;

-- ----------------------------------------------------------------------------
-- Top sectors by avg time in market  (→ analytics top sectors)
-- ----------------------------------------------------------------------------
create or replace view public.v_top_sectors as
select
  sector,
  round(avg(extract(epoch from now() - current_stage_since) / 86400.0))::int as avg_days,
  count(*)::int as n
from public.companies
where current_stage = 'in_market'
group by sector
order by avg_days desc;

-- ----------------------------------------------------------------------------
-- Sponsor activity  (→ analytics sponsor leaderboard)
-- ----------------------------------------------------------------------------
create or replace view public.v_sponsor_activity as
select
  sponsor_firm                                  as sponsor,
  count(*)::int                                 as processes,
  mode() within group (order by sector)         as top_sector
from public.companies
where deal_type = 'private_asset'
  and sponsor_firm is not null
  and sponsor_firm <> 'Undisclosed'
  and current_stage in ('in_market', 'monitor_for_exit')
group by sponsor_firm
order by processes desc, sponsor asc;

-- ----------------------------------------------------------------------------
-- Signal source breakdown  (→ analytics "where signals come from")
-- ----------------------------------------------------------------------------
create or replace view public.v_signal_sources as
select
  source_type,
  count(*)::int                                             as count,
  round(100.0 * count(*) / nullif(sum(count(*)) over (), 0))::int as pct
from public.signals_raw
where source_type is not null
group by source_type
order by count desc;

-- ----------------------------------------------------------------------------
-- Stage transition rates  (→ analytics transition rates)
-- ----------------------------------------------------------------------------
create or replace view public.v_transition_rates as
with seq as (
  select
    company_id,
    stage,
    lag(stage) over (partition by company_id order by changed_at) as prev
  from public.deal_stage_history
)
select
  prev as from_stage,
  stage as to_stage,
  count(*)::int as count,
  round(100.0 * count(*) / nullif(sum(count(*)) over (partition by prev), 0))::int as pct
from seq
where prev is not null and prev <> stage
group by prev, stage;

-- ----------------------------------------------------------------------------
-- Velocity — new entries per week (range-filterable)  (→ analytics velocity)
-- ----------------------------------------------------------------------------
create or replace function public.rpc_velocity(
  p_from date default (now() - interval '182 days')::date,
  p_to   date default now()::date
)
returns table (week_start date, carveout int, private_asset int, total int)
language sql stable as $$
  select
    date_trunc('week', created_at)::date as week_start,
    count(*) filter (where deal_type = 'carveout')::int        as carveout,
    count(*) filter (where deal_type = 'private_asset')::int   as private_asset,
    count(*)::int                                              as total
  from public.companies
  where created_at::date between p_from and p_to
  group by 1
  order by 1;
$$;

-- ----------------------------------------------------------------------------
-- Heatmap — events per day (range-filterable)  (→ analytics 90-day heatmap)
-- ----------------------------------------------------------------------------
create or replace function public.rpc_heatmap(
  p_from date default (now() - interval '89 days')::date,
  p_to   date default now()::date
)
returns table (day date, events int, stage_changes int, new_entries int)
language sql stable as $$
  select
    changed_at::date as day,
    count(*)::int    as events,
    count(*) filter (where event_type in
      ('moved_in_market','moved_monitor','moved_on_hold','pulled'))::int as stage_changes,
    count(*) filter (where event_type = 'new_entry')::int                as new_entries
  from public.deal_stage_history
  where changed_at::date between p_from and p_to
  group by 1
  order by 1;
$$;

-- ----------------------------------------------------------------------------
-- Summary metrics for a range  (→ analytics metric cards)
-- ----------------------------------------------------------------------------
create or replace function public.rpc_summary_metrics(
  p_from date default (now() - interval '7 days')::date,
  p_to   date default now()::date
)
returns table (
  new_deals       int,
  stage_changes   int,
  avg_days_market int,
  pulled          int,
  needs_review    int,
  avg_confidence  numeric
)
language sql stable as $$
  select
    (select count(*) from public.companies
       where created_at::date between p_from and p_to)::int,
    (select count(*) from public.deal_stage_history
       where changed_at::date between p_from and p_to
         and event_type in ('moved_in_market','moved_monitor','moved_on_hold','pulled'))::int,
    (select round(avg(extract(epoch from now() - current_stage_since)/86400.0))
       from public.companies where current_stage = 'in_market')::int,
    (select count(*) from public.deal_stage_history
       where changed_at::date between p_from and p_to and event_type = 'pulled')::int,
    (select count(*) from public.companies where confidence = 'needs_review')::int,
    (select round(avg(case confidence
        when 'high' then 0.95 when 'medium' then 0.80
        when 'low' then 0.60 else 0.40 end), 2)
       from public.companies);
$$;

-- ----------------------------------------------------------------------------
-- Atomic stage update  (→ PATCH /api/companies/[id]; review override)
--   Updates companies.current_stage AND writes deal_stage_history in one tx.
--   SECURITY DEFINER so the single call is atomic regardless of client.
-- ----------------------------------------------------------------------------
create or replace function public.rpc_apply_stage(
  p_company_id  uuid,
  p_stage       stage_enum,
  p_confidence  confidence_enum default null,
  p_changed_by  changed_by_enum default 'analyst_manual',
  p_source_type source_type_enum default 'manual',
  p_notes       text default null
)
returns public.deal_stage_history
language plpgsql security definer set search_path = public as $$
declare
  v_event feed_event_enum;
  v_row   public.deal_stage_history;
begin
  v_event := case p_stage
    when 'in_market'        then 'moved_in_market'
    when 'monitor_for_exit' then 'moved_monitor'
    when 'on_hold'          then 'moved_on_hold'
    when 'pulled'           then 'pulled'
  end::feed_event_enum;

  update public.companies
     set current_stage = p_stage,
         confidence    = coalesce(p_confidence, confidence)
   where id = p_company_id;

  insert into public.deal_stage_history
    (company_id, stage, event_type, changed_by, source_type, notes)
  values
    (p_company_id, p_stage, v_event, p_changed_by, p_source_type, p_notes)
  returning * into v_row;

  return v_row;
end $$;

-- ----------------------------------------------------------------------------
-- Grants — authenticated clients may read views and call analytics RPCs.
-- ----------------------------------------------------------------------------
grant select on
  public.v_company_last_signal,
  public.v_summary_counts,
  public.v_sector_stage,
  public.v_deal_split,
  public.v_confidence_dist,
  public.v_exit_funnel,
  public.v_top_sectors,
  public.v_sponsor_activity,
  public.v_signal_sources,
  public.v_transition_rates
to authenticated;

grant execute on function
  public.rpc_velocity(date, date),
  public.rpc_heatmap(date, date),
  public.rpc_summary_metrics(date, date),
  public.rpc_apply_stage(uuid, stage_enum, confidence_enum, changed_by_enum, source_type_enum, text)
to authenticated;

-- ============================================================
-- migrations/0003_layer5.sql
-- ============================================================
-- ============================================================================
-- Arbor — Layer 5: analytics support (range event counts + recent changes)
-- Idempotent. Apply after 0002_analytics.sql.
-- ============================================================================

-- Range event counts (→ /analytics metric context + feed-sidebar "Activity
-- summary" 5 categories).
create or replace function public.rpc_event_counts(
  p_from date default (now() - interval '7 days')::date,
  p_to   date default now()::date
)
returns table (
  stage_changes      int,
  new_entries        int,
  pulled             int,
  flagged            int,
  confidence_updates int
)
language sql stable as $$
  select
    count(*) filter (where event_type in
      ('moved_in_market','moved_monitor','moved_on_hold','pulled'))::int,
    count(*) filter (where event_type = 'new_entry')::int,
    count(*) filter (where event_type = 'pulled')::int,
    count(*) filter (where event_type = 'flagged')::int,
    count(*) filter (where event_type = 'confidence_update')::int
  from public.deal_stage_history
  where changed_at::date between p_from and p_to;
$$;

-- Recent stage changes with the prior stage (→ /analytics "Recent stage changes").
create or replace view public.v_recent_changes as
with seq as (
  select
    h.id,
    h.company_id,
    c.name,
    h.stage,
    lag(h.stage) over (partition by h.company_id order by h.changed_at) as prev,
    h.source_type,
    h.changed_at
  from public.deal_stage_history h
  join public.companies c on c.id = h.company_id
  where h.event_type in ('moved_in_market','moved_monitor','moved_on_hold','pulled')
)
select id, company_id, name, prev as from_stage, stage as to_stage, source_type, changed_at
from seq
order by changed_at desc;

grant select on public.v_recent_changes to authenticated;
grant execute on function public.rpc_event_counts(date, date) to authenticated;

-- ============================================================
-- migrations/0004_features.sql
-- ============================================================
-- ============================================================================
-- Arbor — feature support: allow authenticated analysts to add companies.
-- Idempotent. Apply after 0003_layer5.sql.
-- ============================================================================

-- companies: authenticated users may insert (the "Add company" form). Reads,
-- updates already covered by 0001. Pipelines use the service role (bypass RLS).
drop policy if exists "companies_insert" on public.companies;
create policy "companies_insert" on public.companies
  for insert to authenticated with check (true);

-- ============================================================
-- seed.sql
-- ============================================================
-- ============================================================================
-- Arbor — seed data.  Apply AFTER 0001_init.sql + 0002_analytics.sql.
-- Safe to re-run (truncates app tables; never touches auth.users).
--   • ~14 "hero" companies matching the frontend mock (named, rich signals)
--   • ~1040 synthetic companies for realistic aggregate volume (~1,054 total)
-- Watchlist + analyst_notes are NOT seeded (they require real auth.users rows).
-- ============================================================================

truncate table
  public.deal_stage_history,
  public.signals_raw,
  public.analyst_notes,
  public.watchlist,
  public.llm_usage,
  public.companies
restart identity cascade;

-- ----------------------------------------------------------------------------
-- 1) Bulk synthetic universe (volume for analytics / summary strip)
-- ----------------------------------------------------------------------------
insert into public.companies
  (name, sector, deal_type, sponsor_firm, parent_company, confidence,
   current_stage, current_stage_since, created_at, updated_at)
select
  'Tracked Asset ' || g,
  (array['chemicals','industrials','agriculture','specialty_materials',
         'energy_fuels','pharma_inputs','consumer_coatings'])[1 + (g % 7)]::sector_enum,
  d.deal_type,
  case when d.deal_type = 'private_asset'
       then (array['Carlyle Group','Bain Capital','One Rock Capital Partners',
                   'SK Capital Partners','Advent International','Apollo Global',
                   'KPS Capital','Blackstone','Arsenal Capital Partners','H.I.G. Capital'])[1 + (g % 10)]
  end,
  case when d.deal_type = 'carveout'
       then (array['Dow Inc.','Celanese Corporation','Shell plc','Braskem S.A.',
                   'Cargill Inc.','Koch Industries','BASF SE','Eastman Chemical',
                   'Honeywell','Syngenta Group'])[1 + (g % 10)]
  end,
  (array['high','high','medium','medium','low','needs_review'])[1 + (g % 6)]::confidence_enum,
  (array['in_market','monitor_for_exit','monitor_for_exit',
         'on_hold','on_hold','pulled'])[1 + (g % 6)]::stage_enum,
  b.since,
  b.since - ((5 + (g % 120)) || ' days')::interval,
  b.since
from generate_series(1, 1040) g
cross join lateral (select (array['carveout','private_asset'])[1 + (g % 2)]::deal_type_enum as deal_type) d
cross join lateral (select now() - ((g % 150) || ' days')::interval as since) b;

-- ----------------------------------------------------------------------------
-- 2) Hero companies (match lib/feed-data.ts / lib/radar-data.ts)
-- ----------------------------------------------------------------------------
insert into public.companies
  (name, sector, deal_type, sponsor_firm, parent_company, description,
   confidence, current_stage, current_stage_since, created_at, updated_at)
values
  ('Dow Polyurethanes','chemicals','carveout',null,'Dow Inc.',
    'Polyurethanes and PO/PG unit under strategic review.',
    'high','in_market', now()-interval '47 days', now()-interval '80 days', now()-interval '2 days'),
  ('Sachem','chemicals','private_asset','One Rock Capital Partners',null,
    'Specialty electronic & performance chemicals producer.',
    'high','in_market', now()-interval '12 days', now()-interval '30 days', now()-interval '4 days'),
  ('EPSilyte','chemicals','private_asset','INEOS Group',null,
    'Expandable polystyrene producer.',
    'high','in_market', now()-interval '7 days', now()-interval '14 days', now()-interval '1 days'),
  ('Nouryon Surfactants','specialty_materials','private_asset','Carlyle Group',null,
    'Surfactants division running a formal sale process.',
    'medium','in_market', now()-interval '3 days', now()-interval '4 days', now()-interval '3 days'),
  ('GEON Performance Solutions','chemicals','private_asset','West Street Capital Partners',null,
    'PVC compounding business spun out of PolyOne.',
    'high','in_market', now()-interval '18 days', now()-interval '60 days', now()-interval '5 days'),
  ('Mosaic Brazil Assets','agriculture','carveout',null,'Mosaic Company',
    'Brazilian distribution and blending assets.',
    'medium','monitor_for_exit', now()-interval '150 days', now()-interval '160 days', now()-interval '2 days'),
  ('Archroma','specialty_materials','private_asset','SK Capital Partners',null,
    'Textile and paper chemicals company.',
    'high','monitor_for_exit', now()-interval '1 days', now()-interval '1 days', now()-interval '1 days'),
  ('Altivia','chemicals','private_asset','Undisclosed',null,
    'Phenol, acetone and water-treatment chemistries.',
    'needs_review','monitor_for_exit', now()-interval '330 days', now()-interval '340 days', now()-interval '7 days'),
  ('Celanese Infraserv','industrials','carveout',null,'Celanese Corporation',
    'Site-services and utilities operations.',
    'high','monitor_for_exit', now()-interval '240 days', now()-interval '245 days', now()-interval '21 days'),
  ('Invista Nylon 6,6 Plants','industrials','carveout',null,'Koch Industries',
    'Integrated nylon 6,6 intermediates and polymer business.',
    'high','on_hold', now()-interval '3 days', now()-interval '70 days', now()-interval '1 days'),
  ('Cargill Deicing Salt','agriculture','carveout',null,'Cargill Inc.',
    'Deicing salt business — divestiture pulled.',
    'high','pulled', now()-interval '5 days', now()-interval '95 days', now()-interval '5 days'),
  ('Shell Phenol Assets','energy_fuels','carveout',null,'Shell plc',
    'Phenol and acetone production assets.',
    'high','on_hold', now()-interval '60 days', now()-interval '90 days', now()-interval '21 days'),
  ('Hexion Versatic Acids','chemicals','carveout',null,'Hexion Inc.',
    'Versatic acids and derivatives unit.',
    'needs_review','monitor_for_exit', now()-interval '90 days', now()-interval '95 days', now()-interval '3 days'),
  ('Innospec Fuel Specialties','energy_fuels','carveout',null,'Innospec Inc.',
    'Fuel specialties segment under strategic review.',
    'medium','monitor_for_exit', now()-interval '2 days', now()-interval '5 days', now()-interval '2 days');

-- ----------------------------------------------------------------------------
-- 3) One auto-ingested signal per company (powers source mix + last-signal view)
-- ----------------------------------------------------------------------------
insert into public.signals_raw
  (company_id, raw_text, source_url, source_type, source_name, doc_type, ingested_at, processed)
select
  id,
  'Automated signal for ' || name,
  '#',
  (array['sec_filing','earnings_transcript','google_news','rss_feed','manual'])
    [1 + (abs(hashtext(id::text)) % 5)]::source_type_enum,
  'Pipeline',
  'Auto',
  now() - ((abs(hashtext(id::text)) % 40) || ' days')::interval,
  true
from public.companies;

-- ----------------------------------------------------------------------------
-- 4) History for every company: a new_entry event + current-stage transition
-- ----------------------------------------------------------------------------
insert into public.deal_stage_history
  (company_id, stage, event_type, changed_at, changed_by, source_type)
select
  id, 'in_market', 'new_entry', created_at, 'system_auto',
  (array['sec_filing','google_news','rss_feed','earnings_transcript'])
    [1 + (abs(hashtext(id::text)) % 4)]::source_type_enum
from public.companies;

insert into public.deal_stage_history
  (company_id, stage, event_type, changed_at, changed_by, source_type)
select
  id,
  current_stage,
  (case current_stage
     when 'monitor_for_exit' then 'moved_monitor'
     when 'on_hold'          then 'moved_on_hold'
     when 'pulled'           then 'pulled'
     else 'moved_in_market' end)::feed_event_enum,
  current_stage_since, 'system_auto',
  (array['sec_filing','google_news','rss_feed','earnings_transcript'])
    [1 + (abs(hashtext(id::text || 'x')) % 4)]::source_type_enum
from public.companies
where current_stage <> 'in_market';

-- ----------------------------------------------------------------------------
-- 5) Rich hero signals + linked stage-change history (exercise feed adapter)
--    Each block: insert the extracted signal, then a history row pointing to it.
-- ----------------------------------------------------------------------------

-- Dow — quote
with s as (
  insert into public.signals_raw (company_id, raw_text, source_url, source_type, source_name, doc_type, ingested_at, processed, llm_output)
  select id, 'Dow 8-K excerpt', '#', 'sec_filing', 'SEC EDGAR', '8-K filing', now()-interval '2 days', true,
    jsonb_build_object('event_type','moved_in_market','stage','in_market','confidence','high',
      'headline','moved from monitor for exit to in market',
      'key_quote','Goldman Sachs and Morgan Stanley engaged as advisors to explore strategic alternatives for the Polyurethanes segment.',
      'attribution','Dow Inc. Form 8-K, 3 Jun 2026')
  from public.companies where name='Dow Polyurethanes' returning id, company_id)
insert into public.deal_stage_history (company_id, signal_id, stage, event_type, changed_at, changed_by, source_type, source_name, doc_type, headline)
select company_id, id, 'in_market','moved_in_market', now()-interval '2 days','system_auto','sec_filing','SEC EDGAR','8-K filing','moved from monitor for exit to in market' from s;

-- Sachem — quote
with s as (
  insert into public.signals_raw (company_id, raw_text, source_url, source_type, source_name, doc_type, ingested_at, processed, llm_output)
  select id, 'Bloomberg report', '#', 'google_news', 'Bloomberg M&A', 'News article', now()-interval '4 days', true,
    jsonb_build_object('event_type','moved_in_market','stage','in_market','confidence','high',
      'headline','moved from monitor for exit to in market',
      'key_quote','Sachem Inc. has kicked off a sale process that could value the business at more than $600 million.',
      'attribution','Bloomberg M&A, 2 Jun 2026')
  from public.companies where name='Sachem' returning id, company_id)
insert into public.deal_stage_history (company_id, signal_id, stage, event_type, changed_at, changed_by, source_type, source_name, doc_type, headline)
select company_id, id, 'in_market','moved_in_market', now()-interval '4 days','system_auto','google_news','Bloomberg M&A','News article','moved from monitor for exit to in market' from s;

-- GEON — quote
with s as (
  insert into public.signals_raw (company_id, raw_text, source_url, source_type, source_name, doc_type, ingested_at, processed, llm_output)
  select id, 'PE Wire brief', '#', 'google_news', 'PE Wire', 'Deal brief', now()-interval '5 days', true,
    jsonb_build_object('event_type','moved_in_market','stage','in_market','confidence','high',
      'headline','moved from monitor for exit to in market',
      'key_quote','Houlihan Lokey hired to run a sale process. First round bids expected late Q3 2026.',
      'attribution','PE Wire Deal Brief, 31 May 2026')
  from public.companies where name='GEON Performance Solutions' returning id, company_id)
insert into public.deal_stage_history (company_id, signal_id, stage, event_type, changed_at, changed_by, source_type, source_name, doc_type, headline)
select company_id, id, 'in_market','moved_in_market', now()-interval '5 days','system_auto','google_news','PE Wire','Deal brief','moved from monitor for exit to in market' from s;

-- Nouryon — new entry
with s as (
  insert into public.signals_raw (company_id, raw_text, source_url, source_type, source_name, doc_type, ingested_at, processed, llm_output)
  select id, 'PE Wire new mandate', '#', 'google_news', 'PE Wire', 'Deal brief', now()-interval '3 days', true,
    jsonb_build_object('event_type','new_entry','stage','in_market','confidence','medium',
      'headline','added to tracker — private asset, Specialty materials',
      'deal_size','$800M–$1.2B',
      'new_entry', jsonb_build_object('owner_label','Sponsor','owner_name','Carlyle Group','deal_size','$800M–$1.2B',
        'reason','Jefferies mandated to run a formal sale process for Nouryon''s surfactants division.'))
  from public.companies where name='Nouryon Surfactants' returning id, company_id)
insert into public.deal_stage_history (company_id, signal_id, stage, event_type, changed_at, changed_by, source_type, source_name, doc_type, headline)
select company_id, id, 'in_market','new_entry', now()-interval '3 days','system_auto','google_news','PE Wire','Deal brief','added to tracker — private asset, Specialty materials' from s;

-- Mosaic — quote
with s as (
  insert into public.signals_raw (company_id, raw_text, source_url, source_type, source_name, doc_type, ingested_at, processed, llm_output)
  select id, 'Mosaic earnings call', '#', 'earnings_transcript', 'Mosaic Co. Q1 2026 earnings call', 'Transcript', now()-interval '2 days', true,
    jsonb_build_object('event_type','moved_monitor','stage','monitor_for_exit','confidence','medium',
      'headline','moved from on hold to monitor for exit',
      'key_quote','We remain open to the right transaction at the right value for our Brazilian distribution assets.',
      'attribution','The Mosaic Company Q1 2026 Earnings Call, 1 Jun 2026')
  from public.companies where name='Mosaic Brazil Assets' returning id, company_id)
insert into public.deal_stage_history (company_id, signal_id, stage, event_type, changed_at, changed_by, source_type, source_name, doc_type, headline)
select company_id, id, 'monitor_for_exit','moved_monitor', now()-interval '2 days','system_auto','earnings_transcript','Mosaic Co. Q1 2026 earnings call','Transcript','moved from on hold to monitor for exit' from s;

-- Archroma — quote
with s as (
  insert into public.signals_raw (company_id, raw_text, source_url, source_type, source_name, doc_type, ingested_at, processed, llm_output)
  select id, 'Reuters report', '#', 'google_news', 'Reuters M&A', 'News article', now()-interval '1 days', true,
    jsonb_build_object('event_type','new_entry','stage','monitor_for_exit','confidence','high',
      'headline','added to tracker — private asset, Specialty materials',
      'new_entry', jsonb_build_object('owner_label','Sponsor','owner_name','SK Capital Partners','deal_size','Undisclosed',
        'reason','SK Capital exploring exit options for Archroma, acquired in 2021.'))
  from public.companies where name='Archroma' returning id, company_id)
insert into public.deal_stage_history (company_id, signal_id, stage, event_type, changed_at, changed_by, source_type, source_name, doc_type, headline)
select company_id, id, 'monitor_for_exit','new_entry', now()-interval '1 days','system_auto','google_news','Reuters M&A','News article','added to tracker — private asset, Specialty materials' from s;

-- Altivia — conflict (flagged)
with s as (
  insert into public.signals_raw (company_id, raw_text, source_url, source_type, source_name, doc_type, ingested_at, processed, llm_output)
  select id, 'Conflicting coverage', '#', 'google_news', 'Google News', 'Two conflicting articles', now()-interval '7 days', true,
    jsonb_build_object('event_type','flagged','stage','monitor_for_exit','confidence','needs_review',
      'headline','flagged for analyst review — conflicting signals detected',
      'conflict', jsonb_build_object(
        'signalA', jsonb_build_object('source','Reuters, 28 May','text','in active sale process with three strategic bidders.','stage','in_market'),
        'signalB', jsonb_build_object('source','Chemical Week, 30 May','text','process paused amid feedstock pricing concerns.','stage','on_hold')))
  from public.companies where name='Altivia' returning id, company_id)
insert into public.deal_stage_history (company_id, signal_id, stage, event_type, changed_at, changed_by, source_type, source_name, doc_type, headline)
select company_id, id, 'monitor_for_exit','flagged', now()-interval '7 days','system_auto','google_news','Google News','Two conflicting articles','flagged for analyst review — conflicting signals detected' from s;

-- Invista — quote (on hold)
with s as (
  insert into public.signals_raw (company_id, raw_text, source_url, source_type, source_name, doc_type, ingested_at, processed, llm_output)
  select id, 'Koch earnings call', '#', 'earnings_transcript', 'Koch Industries Q1 2026 earnings call', 'Transcript', now()-interval '1 days', true,
    jsonb_build_object('event_type','moved_on_hold','stage','on_hold','confidence','high',
      'headline','process placed on hold by Koch Industries',
      'key_quote','We have made the decision to pause the divestiture process and will reassess in H2 2026.',
      'attribution','Koch Industries Q1 2026 Earnings Call, 2 Jun 2026')
  from public.companies where name='Invista Nylon 6,6 Plants' returning id, company_id)
insert into public.deal_stage_history (company_id, signal_id, stage, event_type, changed_at, changed_by, source_type, source_name, doc_type, headline)
select company_id, id, 'on_hold','moved_on_hold', now()-interval '1 days','system_auto','earnings_transcript','Koch Industries Q1 2026 earnings call','Transcript','process placed on hold by Koch Industries' from s;

-- Cargill — quote (pulled)
with s as (
  insert into public.signals_raw (company_id, raw_text, source_url, source_type, source_name, doc_type, ingested_at, processed, llm_output)
  select id, 'Cargill press release', '#', 'google_news', 'Cargill', 'Press release', now()-interval '5 days', true,
    jsonb_build_object('event_type','pulled','stage','pulled','confidence','high',
      'headline','pulled from process — asset retained by Cargill',
      'key_quote','Cargill has determined deicing salt is a strong strategic fit and will not be divesting.',
      'attribution','Cargill Press Release, 1 Jun 2026')
  from public.companies where name='Cargill Deicing Salt' returning id, company_id)
insert into public.deal_stage_history (company_id, signal_id, stage, event_type, changed_at, changed_by, source_type, source_name, doc_type, headline)
select company_id, id, 'pulled','pulled', now()-interval '5 days','system_auto','google_news','Cargill','Press release','pulled from process — asset retained by Cargill' from s;

-- Hexion — conflict (flagged)
with s as (
  insert into public.signals_raw (company_id, raw_text, source_url, source_type, source_name, doc_type, ingested_at, processed, llm_output)
  select id, 'Conflicting coverage', '#', 'google_news', 'Google News', 'Two conflicting articles', now()-interval '3 days', true,
    jsonb_build_object('event_type','flagged','stage','monitor_for_exit','confidence','needs_review',
      'headline','flagged for analyst review — conflicting signals detected',
      'conflict', jsonb_build_object(
        'signalA', jsonb_build_object('source','Mergermarket, 1 June','text','process ongoing with four financial sponsors in second round.','stage','in_market'),
        'signalB', jsonb_build_object('source','Hexion IR statement, 2 June','text','we do not comment on market speculation regarding portfolio decisions.','stage','on_hold')))
  from public.companies where name='Hexion Versatic Acids' returning id, company_id)
insert into public.deal_stage_history (company_id, signal_id, stage, event_type, changed_at, changed_by, source_type, source_name, doc_type, headline)
select company_id, id, 'monitor_for_exit','flagged', now()-interval '3 days','system_auto','google_news','Google News','Two conflicting articles','flagged for analyst review — conflicting signals detected' from s;

-- Innospec — new entry
with s as (
  insert into public.signals_raw (company_id, raw_text, source_url, source_type, source_name, doc_type, ingested_at, processed, llm_output)
  select id, 'Innospec 10-K', '#', 'sec_filing', 'SEC EDGAR', '10-K filing', now()-interval '2 days', true,
    jsonb_build_object('event_type','new_entry','stage','monitor_for_exit','confidence','medium',
      'headline','added to tracker — carveout, Energy & fuels',
      'new_entry', jsonb_build_object('owner_label','Parent','owner_name','Innospec Inc.','deal_size','Undisclosed',
        'reason','Annual report indicates the Fuel Specialties segment is under strategic review.'))
  from public.companies where name='Innospec Fuel Specialties' returning id, company_id)
insert into public.deal_stage_history (company_id, signal_id, stage, event_type, changed_at, changed_by, source_type, source_name, doc_type, headline)
select company_id, id, 'monitor_for_exit','new_entry', now()-interval '2 days','system_auto','sec_filing','SEC EDGAR','10-K filing','added to tracker — carveout, Energy & fuels' from s;

-- ----------------------------------------------------------------------------
-- 6) Sample LLM usage rows (cost tracking demo)
-- ----------------------------------------------------------------------------
insert into public.llm_usage (source_type, model, input_tokens, output_tokens, cost_usd, created_at)
select
  (array['sec_filing','google_news','rss_feed','earnings_transcript'])[1 + (g % 4)]::source_type_enum,
  'claude-sonnet-4-20250514',
  800 + (g % 600), 120 + (g % 200),
  round((0.003 + (g % 50) * 0.0001)::numeric, 4),
  now() - ((g % 7) || ' days')::interval
from generate_series(1, 60) g;
