-- ============================================================================
-- Arbor — RLS performance (clears Supabase "Auth RLS Initialization Plan" +
-- "Multiple Permissive Policies" warnings) + covering indexes for FKs.
-- Idempotent. Apply anytime. No behavior change — same access, faster plans.
-- ============================================================================

-- watchlist: one FOR ALL policy; auth.uid() wrapped in a subselect so it is
-- evaluated once per statement, not once per row.
drop policy if exists "watchlist_rw" on public.watchlist;
create policy "watchlist_rw" on public.watchlist
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- analyst_notes: keep notes_read for SELECT; replace the FOR ALL notes_write
-- (which double-covered SELECT) with command-specific write policies, each
-- using (select auth.uid()).
drop policy if exists "notes_write" on public.analyst_notes;
drop policy if exists "notes_insert" on public.analyst_notes;
create policy "notes_insert" on public.analyst_notes
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "notes_update" on public.analyst_notes;
create policy "notes_update" on public.analyst_notes
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "notes_delete" on public.analyst_notes;
create policy "notes_delete" on public.analyst_notes
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- covering indexes for foreign keys flagged by the advisor.
create index if not exists idx_notes_user on public.analyst_notes (user_id);
create index if not exists idx_history_signal on public.deal_stage_history (signal_id);
