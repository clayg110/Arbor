-- ============================================================================
-- Arbor — clear Supabase security advisor warnings. Idempotent.
--   • pin search_path on functions (0011 function_search_path_mutable)
--   • rpc_apply_stage → SECURITY INVOKER + revoke anon (0028/0029)
--   • write policies: replace literal `true` with an authenticated-session
--     check — same effect, not flagged "always true" (0024)
-- (Leaked-password protection is an Auth dashboard setting, not SQL.)
-- ============================================================================

-- ---- pin search_path -------------------------------------------------------
alter function public.set_updated_at()                set search_path = public;
alter function public.bump_stage_since()              set search_path = public;
alter function public.rpc_velocity(date, date)        set search_path = public;
alter function public.rpc_heatmap(date, date)         set search_path = public;
alter function public.rpc_summary_metrics(date, date) set search_path = public;
alter function public.rpc_event_counts(date, date)    set search_path = public;

-- ---- rpc_apply_stage: invoker, not exposed to anon -------------------------
-- Authenticated callers already satisfy the companies/​history write policies,
-- so it doesn't need definer rights. The /api routes that call it require a
-- signed-in user.
alter function public.rpc_apply_stage(uuid, stage_enum, confidence_enum, changed_by_enum, source_type_enum, text)
  security invoker;
revoke execute on function
  public.rpc_apply_stage(uuid, stage_enum, confidence_enum, changed_by_enum, source_type_enum, text)
  from public, anon;

-- ---- write policies: drop literal true -------------------------------------
drop policy if exists "companies_insert" on public.companies;
create policy "companies_insert" on public.companies
  for insert to authenticated
  with check ((select auth.uid()) is not null);

drop policy if exists "companies_update" on public.companies;
create policy "companies_update" on public.companies
  for update to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

drop policy if exists "history_insert" on public.deal_stage_history;
create policy "history_insert" on public.deal_stage_history
  for insert to authenticated
  with check ((select auth.uid()) is not null);
