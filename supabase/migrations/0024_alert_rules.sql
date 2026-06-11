-- 0024_alert_rules.sql
-- User-defined alert rules. When a tracked company changes stage (or is added),
-- the notify cron evaluates active rules and writes in-app notifications (and,
-- when the rule opts in + ALERT_WEBHOOK is set, posts to the webhook). The
-- predicate is a small JSON matcher (sector / dealType / sponsor / stageEnters /
-- minConfidence / minConviction) interpreted by lib/alert-rules.ts.

create table if not exists alert_rules (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  org_id     uuid,
  name       text not null,
  predicate  jsonb not null default '{}'::jsonb,
  webhook    boolean not null default false,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

alter table alert_rules enable row level security;

-- Each user manages only their own rules.
drop policy if exists alert_rules_owner on alert_rules;
create policy alert_rules_owner on alert_rules
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists idx_alert_rules_active on alert_rules (active);
