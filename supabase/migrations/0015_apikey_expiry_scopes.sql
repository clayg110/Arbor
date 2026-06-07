-- ============================================================================
-- Arbor — Layer 15: API key expiry + scopes
-- Additive + idempotent.
-- ============================================================================

alter table public.api_keys add column if not exists expires_at timestamptz;
alter table public.api_keys add column if not exists scopes text[] not null default '{}';
