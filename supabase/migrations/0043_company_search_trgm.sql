-- 0043_company_search_trgm.sql
-- Trigram indexes for the radar text search. /api/companies filters with
-- `name/sponsor_firm/parent_company ILIKE %q%`, which can't use a btree index and
-- sequentially scans as the table grows. pg_trgm GIN indexes make those
-- substring matches index-backed. No code change — the existing ILIKE queries
-- use these automatically.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS companies_name_trgm_idx
  ON companies USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS companies_sponsor_firm_trgm_idx
  ON companies USING gin (sponsor_firm gin_trgm_ops);

CREATE INDEX IF NOT EXISTS companies_parent_company_trgm_idx
  ON companies USING gin (parent_company gin_trgm_ops);
