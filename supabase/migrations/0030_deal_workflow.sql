-- Deal workflow: owner assignment, per-company tasks, and outreach log.

-- Owner assignment: who on the team is covering this deal.
ALTER TABLE companies ADD COLUMN owner_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL;

-- Deal tasks: next-action items per company (personal by default; org-visible).
CREATE TABLE deal_tasks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id       uuid NULL,
  title        text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 500),
  due_at       timestamptz NULL,
  completed_at timestamptz NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX deal_tasks_company_idx ON deal_tasks(company_id);

ALTER TABLE deal_tasks ENABLE ROW LEVEL SECURITY;

-- Tasks are visible to the user who created them OR any member of their org.
CREATE POLICY "users manage own tasks" ON deal_tasks FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  )
  WITH CHECK (user_id = auth.uid());

-- Outreach log: activities logged against a company (calls, emails, meetings).
CREATE TABLE outreach_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id       uuid NULL,
  type         text NOT NULL CHECK (type IN ('call', 'email', 'meeting', 'other')),
  note         text NOT NULL CHECK (char_length(note) BETWEEN 1 AND 2000),
  contacted_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX outreach_log_company_idx ON outreach_log(company_id);

ALTER TABLE outreach_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members view outreach" ON outreach_log FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

CREATE POLICY "users manage own outreach" ON outreach_log
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "users delete own outreach" ON outreach_log
  FOR DELETE TO authenticated USING (user_id = auth.uid());
