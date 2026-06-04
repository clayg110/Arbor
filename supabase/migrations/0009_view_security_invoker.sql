-- ============================================================================
-- Arbor — make all views run with the caller's privileges + RLS (clears the
-- Supabase "Security Definer View" advisories). Postgres 15+. Idempotent.
-- Safe: every base table already grants SELECT to authenticated via its RLS
-- read policy, so invoker-rights views return the same rows. Apply anytime.
-- ============================================================================

alter view public.v_company_last_signal set (security_invoker = on);
alter view public.v_summary_counts      set (security_invoker = on);
alter view public.v_sector_stage        set (security_invoker = on);
alter view public.v_deal_split          set (security_invoker = on);
alter view public.v_confidence_dist     set (security_invoker = on);
alter view public.v_exit_funnel         set (security_invoker = on);
alter view public.v_top_sectors         set (security_invoker = on);
alter view public.v_sponsor_activity    set (security_invoker = on);
alter view public.v_signal_sources      set (security_invoker = on);
alter view public.v_transition_rates    set (security_invoker = on);
alter view public.v_recent_changes      set (security_invoker = on);
alter view public.v_pipeline_latest     set (security_invoker = on);
alter view public.v_universe_counts     set (security_invoker = on);
