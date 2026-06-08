# Arbor

Live intelligence on companies moving through private-equity deal lifecycles —
carveouts and private-asset exits. Tracks 1,000+ companies across stages
(in market → monitor for exit → on hold → pulled), with an analyst feed,
analytics, a review queue, and automated signal ingestion.

## Stack

- **Next.js 15** (App Router, TypeScript) · **Tailwind** · **Recharts**
- **Supabase** — Postgres, Auth (email/password), Realtime, RLS
- **Anthropic Claude** — structured signal extraction (forced tool call)
- **Typesense** — search + entity resolution (optional; Supabase `ilike` fallback)
- **Upstash Redis** — LLM rate-limit + pipeline lock (optional; no-op if unset)
- **Vercel** — hosting + cron

## Mock-first design

Every external dependency is **env-guarded**. With no `.env.local`, the app runs
fully on mock data: all pages render, API routes return `503`, and client
fetchers fall back to mock. Add keys and each subsystem "flips on" — no code
changes. The mock frontend is the contract the backend was built against.

## Quick start (mock mode)

```bash
pnpm install
pnpm dev          # http://localhost:3000  → redirects to /radar
```

No environment needed. Explore /radar, /feed, /analytics, /review, /watchlist,
/company/[id]. /admin and auth require the live backend (below).

## Going live (real backend)

1. **Create a Supabase project.** Copy `.env.local.example` → `.env.local` and
   fill the Supabase block (`NEXT_PUBLIC_SUPABASE_URL`, `…_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`) and `ANTHROPIC_API_KEY`.

2. **Apply migrations** (Supabase SQL editor, in numeric order):
   every file in `supabase/migrations/` (`0001_init.sql` … `0018_signal_dedupe.sql`),
   then `supabase/seed.sql`. See `supabase/README.md`. Migrations are additive +
   idempotent, so re-running is safe.

3. **Create users.** Self-signup is enabled at `/signup` (new users default to
   the `analyst` role). Promote someone to `admin` from the Admin page, or set
   `user_metadata.role = "admin"` in the Supabase dashboard for the first admin.

4. **Run.** `pnpm dev`. Unauthenticated requests are redirected to `/login`
   (API routes return `401`). Realtime stage changes stream into /radar + /feed.

### Optional subsystems

- **Search (Typesense):** set `TYPESENSE_*`, then `pnpm sync:search` to create +
  fill the `companies` collection. Without it, search uses a Supabase `ilike`
  fallback.
- **Rate-limit / lock (Upstash):** set `UPSTASH_REDIS_REST_*`. No-op if unset.
- **Web signals (Google CSE):** set `GOOGLE_CUSTOM_SEARCH_*` for the private-asset
  pipeline. Without it, that pipeline runs on RSS only.

## Ingestion pipelines

Two cron jobs (`vercel.json`) feed the tracker:

- **Carveouts** (`/api/ingest/carveouts`, every 6h) — SEC EDGAR full-text search.
- **Private assets** (`/api/ingest/private-assets`, every 12h) — Google CSE per
  tracked company + PE/M&A RSS.

Each fetches source text → Claude extracts a structured signal → entity
resolution (Dice ≥ 0.85) matches or creates a company → stage update + history.
Routes are guarded by `CRON_SECRET` and a distributed lock. Trigger manually
from the Admin page (admin only).

## Auth flows

- `/login` — email + password
- `/signup` — self-serve registration (role: analyst)
- `/forgot-password` → email link → `/auth/reset`
- `/auth/callback` — email-confirmation + recovery code exchange
- Role management — admins change roles / create users from `/admin`

## Routes

| Route           | Description                                                              |
| --------------- | ------------------------------------------------------------------------ |
| `/radar`        | Kanban + table radar — filters, summary strip, sector cards, add company |
| `/feed`         | Activity feed grouped by day + sidebar (live, watchlist, range stats)    |
| `/analytics`    | Metric cards + Recharts (velocity, splits, funnel, heatmap, sources)     |
| `/watchlist`    | Manage watched companies                                                 |
| `/company/[id]` | Profile — timeline, signals, analyst notes (edit/delete), peers          |
| `/review`       | Analyst review queue — Confirm / Override                                |
| `/admin`        | Pipeline health, system stats, user + role management (admin only)       |

## Scripts

```bash
pnpm dev            # dev server
pnpm build          # production build
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint (max-warnings 0)
pnpm format         # prettier --write
pnpm test           # vitest (unit + route)
pnpm test:coverage  # vitest + coverage gate
pnpm test:e2e       # Playwright (mock mode)
pnpm sync:search    # push companies → Typesense
pnpm extract:test   # smoke-test the LLM extractor
```

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system shape, request lifecycle,
  multi-tenancy, ingestion data flow, env-gated subsystems, observability.
- [docs/API.md](docs/API.md) — public API guide (auth, pagination, rate limits,
  errors). Machine-readable spec at `GET /api/v1/openapi` (OpenAPI 3.1).
- [docs/RUNBOOK.md](docs/RUNBOOK.md) — incident response, secret rotation,
  deploy/rollback, on-call checklist.
- [CONTRIBUTING.md](CONTRIBUTING.md) — setup, scripts, quality gates, conventions.
- [SECURITY.md](SECURITY.md) — vulnerability disclosure + hardening summary.

Beyond the analyst app, the platform includes: org/team management with email
invites, role + member admin, Stripe billing (plan-tiered API quotas), a scoped
public API, GDPR data export + account deletion, and a freshness-SLA monitor.

## Architecture notes

- **Adapters** (`lib/adapters/`) are the seam: pure functions mapping DB
  snake_case rows → frontend camelCase shapes. No Supabase imports.
- **`useLive`** (`lib/use-live.ts`) — live fetch + mock fallback + realtime refetch.
- **`requireBackend()`** — API routes return `503` until Supabase env is set.
- **Typed Supabase client** via `Database` generic in `types/db.ts` (row shapes
  are `type`, not `interface`, to satisfy supabase-js's index-signature constraint).
