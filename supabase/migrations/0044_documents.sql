-- 0044_documents.sql
-- Deal document attachments: teasers / CIMs / financials uploaded per company.
-- The binary lives in Supabase Storage (bucket: deal-documents); this row holds
-- the metadata + any auto-extracted financials. Org-scoped RLS mirrors contacts
-- (0036). Idempotent: safe to re-apply.

CREATE TABLE IF NOT EXISTS documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  org_id        uuid NULL,
  created_by    uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  name          text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 300),
  kind          text NOT NULL CHECK (kind IN ('teaser', 'cim', 'financials', 'other')),
  storage_path  text NULL CHECK (storage_path IS NULL OR char_length(storage_path) <= 500),
  content_type  text NULL CHECK (content_type IS NULL OR char_length(content_type) <= 120),
  size_bytes    bigint NULL,
  extracted     jsonb NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS documents_company_idx ON documents(company_id);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members view documents" ON documents;
CREATE POLICY "org members view documents" ON documents FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

DROP POLICY IF EXISTS "members insert documents" ON documents;
CREATE POLICY "members insert documents" ON documents FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      org_id IS NULL
      OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    )
  );

DROP POLICY IF EXISTS "members delete org documents" ON documents;
CREATE POLICY "members delete org documents" ON documents FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );
