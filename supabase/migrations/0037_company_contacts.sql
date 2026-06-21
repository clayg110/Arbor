-- 0037_company_contacts.sql
-- Join table linking contacts to companies with a per-link role
-- (a banker can be M&A Advisor on one deal, an exec elsewhere).
-- Idempotent: safe to re-apply.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contact_role_enum') THEN
    CREATE TYPE contact_role_enum AS ENUM (
      'M&A Advisor',
      'CFO',
      'CEO',
      'Partner',
      'Counsel',
      'Other'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS company_contacts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id  uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  org_id      uuid NULL,
  role        contact_role_enum NOT NULL DEFAULT 'Other',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, contact_id)
);

CREATE INDEX IF NOT EXISTS company_contacts_company_idx ON company_contacts(company_id);
CREATE INDEX IF NOT EXISTS company_contacts_contact_idx ON company_contacts(contact_id);

ALTER TABLE company_contacts ENABLE ROW LEVEL SECURITY;

-- Visible to org members; companies are global so visibility follows the org of
-- the link (NULL org = creator-only via the contact's own RLS on join reads).
DROP POLICY IF EXISTS "org members view company_contacts" ON company_contacts;
CREATE POLICY "org members view company_contacts" ON company_contacts
  FOR SELECT TO authenticated
  USING (
    org_id IS NULL
    OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

DROP POLICY IF EXISTS "members insert company_contacts" ON company_contacts;
CREATE POLICY "members insert company_contacts" ON company_contacts
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id IS NULL
    OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

DROP POLICY IF EXISTS "members update company_contacts" ON company_contacts;
CREATE POLICY "members update company_contacts" ON company_contacts
  FOR UPDATE TO authenticated
  USING (
    org_id IS NULL
    OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  )
  WITH CHECK (
    org_id IS NULL
    OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

DROP POLICY IF EXISTS "members delete company_contacts" ON company_contacts;
CREATE POLICY "members delete company_contacts" ON company_contacts
  FOR DELETE TO authenticated
  USING (
    org_id IS NULL
    OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );
