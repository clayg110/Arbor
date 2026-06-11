-- ============================================================================
-- Arbor — Layer 14: organizations (multi-tenant isolation), audit log, API keys
-- Additive + idempotent. Org membership lives in auth.users.app_metadata.org_id
-- (set via the service role; present in the JWT for RLS). The shared research
-- corpus (companies / signals_raw / deal_stage_history / llm_usage) stays GLOBAL
-- — it is market intelligence common to the deployment, and the cron pipelines
-- write it once. Only tenant-private tables (analyst_notes, watchlist, audit_log,
-- api_keys) are org-scoped.
--
-- Backward compatible: a single-tenant deployment that never creates an org
-- leaves org_id NULL everywhere; the `is not distinct from` checks make NULL ==
-- NULL, so nothing changes until you actually provision orgs (scripts/backfill-orgs).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---- orgs --------------------------------------------------------------------
create table if not exists public.orgs (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

-- Current user's org id from the JWT app_metadata (NULL if unset).
create or replace function public.auth_org_id()
returns uuid language sql stable as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'org_id', '')::uuid
$$;

-- ---- org_id on tenant-private tables ----------------------------------------
alter table public.analyst_notes add column if not exists org_id uuid references public.orgs(id) on delete cascade;
alter table public.watchlist     add column if not exists org_id uuid references public.orgs(id) on delete cascade;
create index if not exists idx_notes_org on public.analyst_notes (org_id);
create index if not exists idx_watchlist_org on public.watchlist (org_id);

-- ---- audit_log ---------------------------------------------------------------
create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references public.orgs(id) on delete cascade,
  user_id     uuid,
  actor_email text,
  action      text not null,          -- "company.stage_override", "note.create", ...
  entity_type text,                   -- "company", "note", "user", "api_key"
  entity_id   text,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_audit_org on public.audit_log (org_id, created_at desc);
create index if not exists idx_audit_entity on public.audit_log (entity_type, entity_id);

-- ---- api_keys ----------------------------------------------------------------
create table if not exists public.api_keys (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.orgs(id) on delete cascade,
  created_by   uuid,
  name         text not null,
  key_prefix   text not null,         -- shown in UI, e.g. "arbor_a1b2c3d4"
  key_hash     text not null unique,  -- sha256(full key) — plaintext never stored
  last_used_at timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists idx_apikeys_org on public.api_keys (org_id);
create index if not exists idx_apikeys_hash on public.api_keys (key_hash);

-- ---- RLS ---------------------------------------------------------------------
alter table public.orgs      enable row level security;
alter table public.audit_log enable row level security;
alter table public.api_keys  enable row level security;

-- orgs: members may read their own org.
drop policy if exists "orgs_read" on public.orgs;
create policy "orgs_read" on public.orgs
  for select to authenticated using (id = (select public.auth_org_id()));

-- analyst_notes: was read-all (cross-tenant leak). Now org-scoped read; writes
-- stay scoped to the owner (auth.uid() = user_id) + same org on insert.
drop policy if exists "notes_read" on public.analyst_notes;
create policy "notes_read" on public.analyst_notes
  for select to authenticated
  using (org_id is not distinct from (select public.auth_org_id()));

drop policy if exists "notes_insert" on public.analyst_notes;
create policy "notes_insert" on public.analyst_notes
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and org_id is not distinct from (select public.auth_org_id())
  );

drop policy if exists "notes_update" on public.analyst_notes;
create policy "notes_update" on public.analyst_notes
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "notes_delete" on public.analyst_notes;
create policy "notes_delete" on public.analyst_notes
  for delete to authenticated using ((select auth.uid()) = user_id);

-- watchlist: owner-only (unchanged) + org scope on write.
drop policy if exists "watchlist_rw" on public.watchlist;
create policy "watchlist_rw" on public.watchlist
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and org_id is not distinct from (select public.auth_org_id())
  );

-- audit_log + api_keys: NO authenticated policies. RLS-enabled with no policy =
-- deny to clients; managed exclusively through the service role in server routes.
