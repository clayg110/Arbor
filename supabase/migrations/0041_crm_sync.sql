-- 0041_crm_sync.sql
-- CRM sync state: one current row per (company, provider) recording the last
-- push to an external CRM (Affinity, etc.). One-way export for now. Org-scoped
-- RLS mirrors contacts (0036). Idempotent: safe to re-apply.

CREATE TABLE IF NOT EXISTS crm_sync (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  org_id       uuid NULL,
  created_by   uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  provider     text NOT NULL CHECK (char_length(provider) BETWEEN 1 AND 50),
  external_id  text NULL CHECK (external_id IS NULL OR char_length(external_id) <= 200),
  status       text NOT NULL CHECK (status IN ('synced', 'error')),
  error        text NULL CHECK (error IS NULL OR char_length(error) <= 500),
  synced_at    timestamptz NOT NULL DEFAULT now()
);

-- One current sync row per company+provider; re-syncing upserts it.
CREATE UNIQUE INDEX IF NOT EXISTS crm_sync_company_provider_idx ON crm_sync(company_id, provider);
CREATE INDEX IF NOT EXISTS crm_sync_org_idx ON crm_sync(org_id);

ALTER TABLE crm_sync ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members view crm_sync" ON crm_sync;
CREATE POLICY "org members view crm_sync" ON crm_sync FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

DROP POLICY IF EXISTS "members insert crm_sync" ON crm_sync;
CREATE POLICY "members insert crm_sync" ON crm_sync FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      org_id IS NULL
      OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    )
  );

DROP POLICY IF EXISTS "members update org crm_sync" ON crm_sync;
CREATE POLICY "members update org crm_sync" ON crm_sync FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  )
  WITH CHECK (
    created_by = auth.uid()
    OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

DROP POLICY IF EXISTS "members delete org crm_sync" ON crm_sync;
CREATE POLICY "members delete org crm_sync" ON crm_sync FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );
