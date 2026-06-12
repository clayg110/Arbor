# Go-Live Deploy Guide

First-time launch of Arbor to production. One-time setup; afterwards day-to-day
ops live in [RUNBOOK.md](./RUNBOOK.md). Order matters — DB first, then env, then
deploy, then verify.

The app is **dormant-until-key**: every integration no-ops without its env var,
so you can ship with the core (Supabase + Anthropic) and switch the rest on later
without a code change.

---

## 0. Prerequisites

- Supabase project (ref `jwjxaalrawxeefbwzkmg`, project id `Arbor`).
- Vercel project linked to the GitHub repo `clayg110/Arbor` (deploys on push to `main`).
- A domain (or use the Vercel `*.vercel.app` URL).

---

## 1. Apply database migrations

Migrations `0035`–`0041` have shipped in code but are **not yet applied** to the
live database. Without them, every Tier 1–3 feature 500s in live mode (the tables
don't exist).

The shipped migrations are first-apply DDL (`CREATE TABLE` / `CREATE TYPE`), so
run them **once, in order, on the existing schema**. Never re-run them and never
edit a shipped migration — add a new one (next counter is `0042`).

**Option A — Supabase SQL editor (matches the established workflow):**

1. Open the Supabase project → SQL editor.
2. Paste the contents of [`go-live-migrations.sql`](./go-live-migrations.sql)
   (a generated, in-order concatenation of `0035`–`0041`) and run it.
   - Regenerate that bundle anytime with:
     ```bash
     for f in 0035 0036 0037 0038 0039 0040 0041; do
       echo "-- $(basename supabase/migrations/${f}_*.sql)"; cat supabase/migrations/${f}_*.sql; echo;
     done
     ```
3. Or paste each `supabase/migrations/00{35..41}_*.sql` individually, in order.

**Option B — Supabase CLI (if you prefer tracked migrations):**

```bash
npm install -g supabase            # CLI not currently installed locally
supabase link --project-ref jwjxaalrawxeefbwzkmg
supabase db push                   # applies pending migrations in order
```

**Verify** all seven landed:

```sql
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in ('funds','crm_sync','deal_bids','company_ic_memos',
                     'contacts','company_contacts');
-- expect 6 rows; plus columns companies.our_process_stage, companies.fund_id
select column_name from information_schema.columns
where table_name = 'companies' and column_name in ('our_process_stage','fund_id');
```

---

## 2. Configure environment variables (Vercel → Project → Settings → Environment Variables)

Grouped by priority. **Core** is required for the app to function in live mode;
the rest each light up one feature and can wait.

### Core (required — app is broken in live mode without these)

| Var                             | Notes                                                                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase → Project Settings → API                                                                                                          |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same page                                                                                                                                  |
| `SUPABASE_SERVICE_ROLE_KEY`     | same page — **server-only**, never `NEXT_PUBLIC`                                                                                           |
| `NEXT_PUBLIC_APP_URL`           | e.g. `https://app.arbor.ai` — used to build absolute URLs incl. the calendar feed subscription link. Set before sharing any calendar feed. |
| `CRON_SECRET`                   | random 32+ char secret; secures `/api/cron/*` and `/api/ingest/*`                                                                          |
| `ANTHROPIC_API_KEY`             | AI memo / Q&A / IC memo / outreach                                                                                                         |

### High-value (most user-visible gaps if missing)

| Var                                                       | Unlocks                                              |
| --------------------------------------------------------- | ---------------------------------------------------- |
| `RESEND_API_KEY` + `EMAIL_FROM`                           | **all email** — invites, digests, LP/report delivery |
| `UPSTASH_REDIS_REST_URL` + `_TOKEN`                       | login lockout + rate limiting                        |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` | bot protection on login/signup                       |
| `SENTRY_DSN` (+ `SENTRY_ORG`/`PROJECT`/`AUTH_TOKEN`)      | error tracking + source maps                         |

### New Tier 3 integrations (dormant until set)

| Var                    | Unlocks                                                      |
| ---------------------- | ------------------------------------------------------------ |
| `CALENDAR_FEED_SECRET` | ICS calendar subscription feed (else `/api/calendar/*` 404s) |
| `AFFINITY_API_KEY`     | one-way CRM push (else "No CRM configured")                  |
| `HSR_SOURCE_URL`       | FTC HSR filing tracker cron (else no-ops)                    |

> Google CSE (`GOOGLE_CUSTOM_SEARCH_API_KEY` / `_ENGINE_ID`) is already set in
> `.env.local`; mirror it into Vercel to keep enrich-on-add + universe scan live
> in prod.

### Billing (when you start charging)

`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`,
`STRIPE_PRICE_ENTERPRISE`. After deploy, point a Stripe webhook at
`https://<app>/api/webhooks/stripe` and copy its signing secret into
`STRIPE_WEBHOOK_SECRET`.

### Alert delivery (optional)

`SLACK_WEBHOOK_URL`, `TEAMS_WEBHOOK_URL`.

---

## 3. Deploy

Push to `main` (already done) → Vercel builds and deploys automatically. CI
(`.github/workflows/ci.yml`) gates format, typecheck, lint, tests+coverage,
build, and `pnpm audit` before merge.

Cron schedules are declared in `vercel.json` and registered by Vercel on deploy:

| Cron                         | Schedule         |
| ---------------------------- | ---------------- |
| `/api/ingest/carveouts`      | every 6h         |
| `/api/ingest/private-assets` | every 12h        |
| `/api/ingest/hsr`            | daily 06:00      |
| `/api/cron/freshness`        | daily 07:00      |
| `/api/cron/digest`           | daily 08:00      |
| `/api/cron/notify`           | hourly           |
| `/api/cron/retention`        | weekly Sun 04:00 |

---

## 4. Smoke-test live mode

```bash
APP=https://<your-app-url>

# Liveness + per-integration config + DB ping. Expect 200, db:"ok".
curl -s "$APP/api/health?deep=1" | jq

# Cron auth is enforced (401 without the secret):
curl -s -o /dev/null -w "%{http_code}\n" "$APP/api/ingest/carveouts"        # 401
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer $CRON_SECRET" "$APP/api/ingest/carveouts"        # 200
```

In the browser, signed in:

- `/radar` loads real companies (not mock).
- Open a company → **Fund** picker lists funds, **CRM** card shows configured/dormant correctly.
- `/reports/lp` renders; CSV download works.
- If `CALENDAR_FEED_SECRET` is set: `/settings` → calendar card shows a feed URL;
  `curl "$APP/api/calendar/<token>.ics"` returns `text/calendar`.

---

## 5. Post-launch

- First ingest run populates data; until then the pipeline is empty — trigger
  manually from `/admin` or via the authorized `curl` above.
- Day-to-day incidents, secret rotation, rollback → [RUNBOOK.md](./RUNBOOK.md).
- On-call checklist lives at the bottom of the runbook.
