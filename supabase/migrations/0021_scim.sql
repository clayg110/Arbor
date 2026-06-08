-- ============================================================================
-- Arbor — Layer 21: SCIM 2.0 provisioning token (per org)
-- Additive + idempotent. An IdP authenticates to /api/scim/v2/* with a bearer
-- token; only its sha256 hash is stored (plaintext shown once at generation).
-- Dormant until an admin generates a token. Service-role only (no client policy).
-- ============================================================================

alter table public.orgs add column if not exists scim_token_hash text;

create unique index if not exists uq_orgs_scim_token
  on public.orgs (scim_token_hash)
  where scim_token_hash is not null;
