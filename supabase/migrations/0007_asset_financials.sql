-- ============================================================================
-- Arbor — per-asset financials + branding (radar card + company page).
-- Idempotent. Apply after 0006_taxonomy.sql. All nullable — populated later by
-- ingestion / manual entry. (description already exists from 0001.)
-- ============================================================================

alter table public.companies add column if not exists logo_url            text;
alter table public.companies add column if not exists revenue             text;  -- e.g. "$1.2B"
alter table public.companies add column if not exists ebitda              text;  -- e.g. "$280M"
alter table public.companies add column if not exists margin              text;  -- e.g. "23%"
alter table public.companies add column if not exists revenue_source_url  text;  -- filing / press release
alter table public.companies add column if not exists ebitda_source_url   text;
