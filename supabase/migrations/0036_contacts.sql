-- 0036_contacts.sql
-- Contact / banker relationship layer: a structured directory of people
-- (advisors, executives, counsel) the team knows. Org-scoped.
-- Idempotent: safe to re-apply.

CREATE TABLE IF NOT EXISTS contacts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NULL,
  created_by   uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  name         text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  title        text NULL CHECK (title IS NULL OR char_length(title) <= 200),
  firm         text NULL CHECK (firm IS NULL OR char_length(firm) <= 200),
  email        text NULL CHECK (email IS NULL OR char_length(email) <= 320),
  phone        text NULL CHECK (phone IS NULL OR char_length(phone) <= 50),
  linkedin_url text NULL CHECK (linkedin_url IS NULL OR char_length(linkedin_url) <= 500),
  notes        text NULL CHECK (notes IS NULL OR char_length(notes) <= 2000),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contacts_org_idx ON contacts(org_id);
CREATE INDEX IF NOT EXISTS contacts_firm_idx ON contacts(firm);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Org-scoped: members see and manage contacts for their org. Contacts created
-- without an org (solo / pre-org) are visible to their creator.
DROP POLICY IF EXISTS "org members view contacts" ON contacts;
CREATE POLICY "org members view contacts" ON contacts FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

DROP POLICY IF EXISTS "members insert contacts" ON contacts;
CREATE POLICY "members insert contacts" ON contacts FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      org_id IS NULL
      OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    )
  );

DROP POLICY IF EXISTS "members update org contacts" ON contacts;
CREATE POLICY "members update org contacts" ON contacts FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  )
  WITH CHECK (
    created_by = auth.uid()
    OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

DROP POLICY IF EXISTS "members delete org contacts" ON contacts;
CREATE POLICY "members delete org contacts" ON contacts FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );
