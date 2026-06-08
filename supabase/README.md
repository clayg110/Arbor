# Arbor — database (Layer 1)

Postgres schema for Supabase. Shapes match the frontend data contracts in
`lib/*-data.ts` so the adapter layer (Layer 2) is a thin map.

## Files (apply in order)

1. `migrations/0001_init.sql` — extensions, enums, tables, indexes, triggers,
   realtime publication, RLS policies.
2. `migrations/0002_analytics.sql` — aggregation views, analytics RPCs, and
   `rpc_apply_stage` (atomic stage update used by the stage-update API route).
3. `seed.sql` — ~14 named "hero" companies (match the frontend mock, with rich
   `llm_output` signals) + ~1,040 synthetic companies for realistic aggregates.
   Does **not** seed `watchlist` / `analyst_notes` (they need real `auth.users`).

## Apply

**Supabase SQL editor:** paste each file in order and run.

**Or Supabase CLI:**

```bash
supabase db push          # runs migrations/
psql "$DATABASE_URL" -f supabase/seed.sql
```

All migrations are idempotent (safe to re-run). `seed.sql` truncates app tables
first (never touches `auth.users`).

## What the frontend consumes

| Frontend need                                                               | Backed by                                                                                                       |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Radar cards / table                                                         | `companies` + `v_company_last_signal`                                                                           |
| Radar summary strip                                                         | `v_summary_counts`                                                                                              |
| Sector cards / stage-by-sector                                              | `v_sector_stage`                                                                                                |
| Feed items (quote / conflict / new-entry)                                   | `deal_stage_history` ⋈ `signals_raw.llm_output`                                                                 |
| Analytics doughnut / confidence / funnel / top sectors / sponsors / sources | `v_deal_split`, `v_confidence_dist`, `v_exit_funnel`, `v_top_sectors`, `v_sponsor_activity`, `v_signal_sources` |
| Analytics velocity / heatmap / metric cards (range)                         | `rpc_velocity`, `rpc_heatmap`, `rpc_summary_metrics`                                                            |
| Stage transition rates                                                      | `v_transition_rates`                                                                                            |
| Stage override / mark-for-review                                            | `rpc_apply_stage`                                                                                               |

## Auth (Layer 3)

- Set `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`). **Without these the app runs in mock mode** —
  `middleware.ts` and the layout become no-ops, so the frontend still works.
- With env present: `middleware.ts` protects every route except `/login`;
  unauthenticated requests redirect to `/login`. `/admin` requires
  `user_metadata.role = 'admin'`.
- Create test users in Supabase dashboard → Authentication → Users. Set role via
  user metadata (raw JSON): `{ "role": "analyst" }` or `{ "role": "admin" }`
  (defaults to `analyst`).

## Notes / decisions baked in

- **UUID ids** → `/company/[id]` becomes dynamic (no static prerender).
- `signals_raw.llm_output` jsonb schema is the feed/review contract — keep stable
  (see comment in `0001_init.sql`). Extraction (Layer 6) must populate it.
- RLS: authenticated read on shared tables (also required for realtime); owner-only
  on watchlist/notes; pipeline writes use the service role.
