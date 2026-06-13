-- ============================================================================
-- Arbor — Layer 17: covering indexes for keyset (cursor) pagination
-- Additive + idempotent. The public API orders companies by updated_at and the
-- feed orders history by changed_at; keyset paging adds id as the tiebreaker.
-- These composite (sortkey desc, id desc) indexes let Postgres satisfy both the
-- ORDER BY and the "(col,id) < cursor" seek from the index alone.
-- ============================================================================

create index if not exists idx_companies_updated_id
  on public.companies (updated_at desc, id desc);

create index if not exists idx_history_changed_id
  on public.deal_stage_history (changed_at desc, id desc);
