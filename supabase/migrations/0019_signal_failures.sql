-- ============================================================================
-- Arbor — Layer 19: dead-letter queue for unprocessable signals
-- Additive + idempotent. The pipeline writes here when extraction hard-fails or
-- the extraction circuit is open, so nothing is silently lost — rows can be
-- inspected and replayed. Service-role only (RLS enabled, no client policy).
-- ============================================================================

create table if not exists public.signal_failures (
  id          uuid primary key default gen_random_uuid(),
  source_url  text,
  source_type text,
  source_name text,
  doc_type    text,
  raw_text    text,
  reason      text,
  created_at  timestamptz not null default now()
);
-- source_name + doc_type added so a failure can be replayed into a full signal.
alter table public.signal_failures add column if not exists source_name text;
alter table public.signal_failures add column if not exists doc_type text;

create index if not exists idx_signal_failures_created
  on public.signal_failures (created_at desc);

alter table public.signal_failures enable row level security;
