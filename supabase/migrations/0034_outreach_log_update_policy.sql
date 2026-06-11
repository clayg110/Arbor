-- 0034_outreach_log_update_policy.sql
-- Add missing UPDATE policy to outreach_log. The table was created in 0030
-- with SELECT / INSERT / DELETE policies but no UPDATE, so any future PATCH
-- endpoint would silently hit RLS denial. Also correct org_id nullability so
-- the org-visibility SELECT clause becomes live once org_id is written.

drop policy if exists outreach_log_update on outreach_log;
create policy outreach_log_update on outreach_log
  for update to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());
