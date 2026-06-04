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

alter view public.v_recent_changes set (security_invoker = on);
