-- ============================================================================
-- Arbor — universe monitoring: track when each §2.1 company was last scanned
-- for divestiture signals, so the pipeline rotates through all of them fairly.
-- Idempotent. Apply before running ingestion with Google configured.
-- ============================================================================

alter table public.universe_companies
  add column if not exists last_scanned_at timestamptz;

-- least-recently-scanned first (nulls = never scanned → highest priority)
create index if not exists idx_universe_last_scanned
  on public.universe_companies (last_scanned_at nulls first);
