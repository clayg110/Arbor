-- ============================================================================
-- Arbor — pipeline run history (powers the live Admin "Pipeline health" rows).
-- Idempotent. Apply after 0004_features.sql.
-- ============================================================================

create table if not exists public.pipeline_runs (
  id        uuid primary key default gen_random_uuid(),
  pipeline  text not null,                 -- 'carveouts' | 'private-assets'
  ran_at    timestamptz not null default now(),
  fetched   int not null default 0,        -- items pulled from sources
  created   int not null default 0,
  updated   int not null default 0,
  flagged   int not null default 0,
  errors    int not null default 0,
  ok        boolean not null default true
);

create index if not exists idx_pipeline_runs_pipeline_time
  on public.pipeline_runs (pipeline, ran_at desc);

alter table public.pipeline_runs enable row level security;

-- Authenticated read (Admin panel). Writes come from the service role (pipelines).
drop policy if exists "pipeline_runs_read" on public.pipeline_runs;
create policy "pipeline_runs_read" on public.pipeline_runs
  for select to authenticated using (true);

-- Latest run per pipeline.
create or replace view public.v_pipeline_latest as
select distinct on (pipeline)
  pipeline, ran_at, fetched, created, updated, flagged, errors, ok
from public.pipeline_runs
order by pipeline, ran_at desc;

grant select on public.pipeline_runs, public.v_pipeline_latest to authenticated;

alter view public.v_pipeline_latest set (security_invoker = on);
