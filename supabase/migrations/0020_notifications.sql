-- ============================================================================
-- Arbor — Layer 20: in-app notifications
-- Additive + idempotent. Per-user notification feed. Rows are written by the
-- service role (the notify cron); each user may read + mark-read only their own.
-- dedupe_key makes the cron idempotent (re-runs don't duplicate a notification).
-- ============================================================================

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  org_id      uuid references public.orgs(id) on delete cascade,
  type        text not null,
  title       text not null,
  body        text,
  entity_type text,
  entity_id   text,
  dedupe_key  text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists idx_notifications_user
  on public.notifications (user_id, created_at desc);
create unique index if not exists uq_notifications_dedupe
  on public.notifications (dedupe_key)
  where dedupe_key is not null;

alter table public.notifications enable row level security;

-- Owners read their own.
drop policy if exists "notifications_read" on public.notifications;
create policy "notifications_read" on public.notifications
  for select to authenticated using ((select auth.uid()) = user_id);

-- Owners may mark their own read (update). Inserts are service-role only.
drop policy if exists "notifications_update" on public.notifications;
create policy "notifications_update" on public.notifications
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
