-- 0023_company_memos.sql
-- Cache for AI-generated deal briefs (lib/memo.ts). One row per company; the
-- route regenerates only when the underlying signal set changes (signals_hash),
-- so repeated views don't re-spend on the LLM. Written by the service role.

create table if not exists company_memos (
  company_id   uuid primary key references companies(id) on delete cascade,
  memo         text not null,
  signals_hash text not null,
  model        text,
  generated_at timestamptz not null default now()
);

alter table company_memos enable row level security;

-- Authenticated members may read cached briefs; writes go through the service role.
drop policy if exists company_memos_read on company_memos;
create policy company_memos_read on company_memos
  for select to authenticated using (true);
