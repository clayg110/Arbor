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

-- Views run with the caller's privileges + RLS (avoids "Security Definer View").
alter view public.v_company_last_signal set (security_invoker = on);
alter view public.v_summary_counts      set (security_invoker = on);
alter view public.v_sector_stage        set (security_invoker = on);
alter view public.v_deal_split          set (security_invoker = on);
alter view public.v_confidence_dist     set (security_invoker = on);
alter view public.v_exit_funnel         set (security_invoker = on);
alter view public.v_top_sectors         set (security_invoker = on);
alter view public.v_sponsor_activity    set (security_invoker = on);
alter view public.v_signal_sources      set (security_invoker = on);
alter view public.v_transition_rates    set (security_invoker = on);
