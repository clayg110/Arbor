-- 0040_funds.sql
-- Fund layer for LP / fund-level reporting. A fund is an org-scoped investment
-- vehicle with a vintage year; deals (companies) can be assigned to one fund.
-- The LP report aggregates the pipeline by fund (vintage) × sector for a chosen
-- quarter. Org-scoped RLS mirrors contacts (0036).

CREATE TABLE funds (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NULL,
  created_by   uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  name         text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  vintage_year int NULL CHECK (vintage_year IS NULL OR (vintage_year BETWEEN 1900 AND 2200)),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX funds_org_idx ON funds(org_id);

ALTER TABLE funds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members view funds" ON funds FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

CREATE POLICY "members insert funds" ON funds FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      org_id IS NULL
      OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    )
  );

CREATE POLICY "members update org funds" ON funds FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  )
  WITH CHECK (
    created_by = auth.uid()
    OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

CREATE POLICY "members delete org funds" ON funds FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

-- Assign a deal to a fund. ON DELETE SET NULL so deleting a fund unassigns its
-- deals rather than removing them from the pipeline.
ALTER TABLE companies ADD COLUMN fund_id uuid NULL REFERENCES funds(id) ON DELETE SET NULL;
CREATE INDEX companies_fund_idx ON companies(fund_id);
