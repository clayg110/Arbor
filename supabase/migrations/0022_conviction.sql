-- 0022_conviction.sql
-- Per-company signal aggregates that sharpen the conviction score (lib/conviction.ts):
-- how many distinct signals landed in the last 30 days, across how many independent
-- source types, and when the most recent one arrived. The score itself is computed
-- in app code; this view just supplies the inputs the mock path can't derive.

create or replace view v_company_conviction as
select
  company_id,
  count(*) filter (where ingested_at > now() - interval '30 days') as signal_count_30d,
  count(distinct source_type) filter (where ingested_at > now() - interval '30 days')
    as distinct_source_types,
  max(ingested_at) as last_signal_at
from signals_raw
where company_id is not null
group by company_id;

-- Read by authenticated clients; runs with the caller's RLS (no Security Definer view).
grant select on public.v_company_conviction to authenticated;
alter view public.v_company_conviction set (security_invoker = on);
