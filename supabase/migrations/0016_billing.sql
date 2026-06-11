-- ============================================================================
-- Arbor — Layer 16: billing (Stripe subscriptions per org)
-- Additive + idempotent. Billing state lives on the org row; writes happen only
-- through the service role (Stripe webhook + billing routes). Members may READ
-- their org (existing orgs_read policy) so the UI can show the current plan.
--
-- Dormant until Stripe is configured: every org defaults to the 'free' plan and
-- nothing here requires Stripe to exist.
-- ============================================================================

alter table public.orgs
  add column if not exists plan                  text not null default 'free',
  add column if not exists stripe_customer_id    text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status   text,
  add column if not exists seats                 int,
  add column if not exists current_period_end    timestamptz;

-- Webhooks look the org up by Stripe customer id.
create index if not exists idx_orgs_stripe_customer on public.orgs (stripe_customer_id);

-- Guard the plan column to the known tiers.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'orgs_plan_check'
  ) then
    alter table public.orgs
      add constraint orgs_plan_check check (plan in ('free', 'pro', 'enterprise'));
  end if;
end $$;
