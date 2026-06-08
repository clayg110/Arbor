# Architecture

Arbor is a Next.js 15 (App Router) application backed by Supabase (Postgres +
Auth + Realtime), with Anthropic Claude for signal extraction and a set of
**env-gated** optional subsystems. Every external dependency degrades to a no-op
when its keys are absent, so the app runs end-to-end on mock data with zero
configuration ("mock mode").

## High-level shape

```
Browser ── Next.js (RSC + route handlers) ── Supabase (Postgres/RLS, Auth, Realtime)
                       │                          ▲
                       ├── Anthropic (extraction) │
                       ├── Stripe (billing)       │
                       ├── Resend (email)         │
                       ├── Upstash (rate limit)   │
                       └── Sentry (errors) ───────┘
Vercel Cron ── /api/ingest/* + /api/cron/freshness
```

## Request lifecycle

1. **Middleware** (`middleware.ts` → `lib/supabase/middleware.ts`) refreshes the
   Supabase session, enforces auth (redirect pages / `401` API), gates `/admin`,
   and stamps an `x-request-id` on request + response.
2. **Route handler / RSC** runs on the Node runtime. API handlers call
   `requireBackend()` (→ `503` in mock mode), authenticate, validate with Zod,
   query Supabase, and map rows via **adapters**.
3. **Adapters** (`lib/adapters/`) are the seam: pure snake_case-row → camelCase
   functions, no Supabase imports — independently unit-tested.
4. **Response** is JSON; reads that are heavy + non-realtime use `cached()`.

## Multi-tenancy

Org membership lives in `auth.users.app_metadata.org_id` (set by the service
role, present in the JWT for RLS via `auth_org_id()`). The **research corpus**
(`companies`, `signals_raw`, `deal_stage_history`, `llm_usage`) is GLOBAL — shared
market intelligence written once by the pipelines. Only tenant-private tables
(`analyst_notes`, `watchlist`, `audit_log`, `api_keys`, `orgs` billing) are
org-scoped. Single-tenant deployments leave `org_id` NULL everywhere and behave
unchanged (`is not distinct from` NULL checks).

## Ingestion pipeline (data flow)

```
cron → fetch sources ─→ Claude extract ─→ resolve entity ─→ persist
       (edgar/rss/cse)   (forced tool)     (Dice ≥ 0.85)     (stage + history)
```

- **Fetchers** (`lib/ingest/edgar|rss|google.ts`) pull source text. Each call is
  wrapped in `withRetry` (transient 429/5xx + network) with per-request timeouts.
- **Extraction** (`lib/extract-signal.ts`) → structured signal via a forced tool
  call, with backoff + Redis LLM rate-limiting + usage logging.
- **Resolution** (`lib/ingest/resolve.ts`) matches to an existing company (Dice
  similarity, optional Typesense) or creates a `needs_review` one.
- **Persistence** (`lib/ingest/persist.ts`) is idempotent: a `dedupe_key`
  (sha256 of url + text) upsert-ignores duplicates, so re-runs are safe.
- **Freshness SLA** (`/api/cron/freshness`) alerts if no signal lands within
  `FRESHNESS_MAX_HOURS`.

## Env-gated subsystems

| Subsystem  | Enabled by                            | Off behavior              |
| ---------- | ------------------------------------- | ------------------------- |
| Backend    | `NEXT_PUBLIC_SUPABASE_URL` + anon key | mock mode (`503` APIs)    |
| Extraction | `ANTHROPIC_API_KEY`                   | pipelines no-op           |
| Search     | `TYPESENSE_*`                         | Supabase `ilike` fallback |
| Rate limit | `UPSTASH_REDIS_REST_*`                | fail-open (allow)         |
| Billing    | `STRIPE_SECRET_KEY`                   | all orgs on `free`        |
| Email      | `RESEND_API_KEY` + `EMAIL_FROM`       | invites return a link     |
| Errors     | `SENTRY_DSN`                          | structured logs only      |
| Alerts     | `ALERT_WEBHOOK_URL`                   | no-op                     |

## Observability

Structured JSON logs (`lib/logger.ts`) auto-tagged with `requestId` via
`AsyncLocalStorage` (`lib/request-context.ts`). `captureException`
(`lib/observability.ts`) logs + forwards to Sentry with the same id.
`withObservedRoute` wraps handlers with an access log + error capture.

## Key directories

```
app/            routes (pages + /api handlers)
components/      UI (ui/ primitives, layout/)
lib/            domain logic — adapters/, ingest/, api/, redis/, supabase/
types/db.ts     typed Supabase Database schema
supabase/        SQL migrations (0001…) + seed
tests/           vitest (unit + route)      e2e/  Playwright (mock mode)
docs/            this folder
```

See [RUNBOOK](./RUNBOOK.md) for operations and [API](./API.md) for the public API.
