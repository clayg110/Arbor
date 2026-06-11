-- 0038_company_ic_memos.sql
-- Cache for the structured IC memo (distinct from the free-form company_memos).
-- One row per company; regenerated when the signal/process/comps fingerprint
-- changes. Service-role writes only (mirrors company_memos); readable to
-- authenticated users.

CREATE TABLE company_ic_memos (
  company_id   uuid PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  memo         text NOT NULL,
  signals_hash text NOT NULL,
  model        text NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE company_ic_memos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ic_memos_read" ON company_ic_memos
  FOR SELECT TO authenticated USING (true);
