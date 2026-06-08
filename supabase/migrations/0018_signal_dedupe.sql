-- ============================================================================
-- Arbor — Layer 18: idempotent signal ingestion
-- Additive + idempotent. A deterministic dedupe_key (sha256 of source_url + raw
-- text) lets the pipeline upsert-ignore duplicates, so re-runs / overlapping
-- cron windows never double-insert the same signal. Partial unique index leaves
-- legacy rows (dedupe_key NULL) unconstrained.
-- ============================================================================

alter table public.signals_raw add column if not exists dedupe_key text;

create unique index if not exists uq_signals_dedupe
  on public.signals_raw (dedupe_key)
  where dedupe_key is not null;
