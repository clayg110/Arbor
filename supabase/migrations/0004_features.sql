-- ============================================================================
-- Arbor — feature support: allow authenticated analysts to add companies.
-- Idempotent. Apply after 0003_layer5.sql.
-- ============================================================================

-- companies: authenticated users may insert (the "Add company" form). Reads,
-- updates already covered by 0001. Pipelines use the service role (bypass RLS).
drop policy if exists "companies_insert" on public.companies;
create policy "companies_insert" on public.companies
  for insert to authenticated with check (true);
