# Operations Runbook

Practical responses to the things that break. Every external dependency is
env-gated, so "is the key set?" is often the first question.

## Triage

1. Check **Sentry** for the error + its `requestId`.
2. Grep logs for that `requestId` — one JSON line per event, end to end.
3. Check **`GET /api/health?deep=1`** — liveness + per-integration config + a DB ping.

## Incidents

### Ingestion has stalled (stale data)

Symptom: freshness alert ("Arbor data is stale…"), or no new feed events.

1. `GET /api/health?deep=1` → confirm `supabase` + `anthropic` are configured.
2. Check the latest pipeline runs on **/admin** (records + errors per run).
3. Manually trigger from /admin (admin only) or
   `curl -H "Authorization: Bearer $CRON_SECRET" $APP/api/ingest/carveouts`.
4. If a single source is failing, fetchers already retry transient errors and
   skip a dead feed — check Sentry for the upstream status.
5. Verify Vercel cron is still scheduled (`vercel.json`).

### Pipeline errors / crash

A run that logs errors posts to `ALERT_WEBHOOK_URL` (`notifyPipelineFailure`);
a hard crash posts `notifyPipelineCrash`. Inspect Sentry, re-run manually. Signal
ingest is idempotent (`dedupe_key`), so re-runs won't duplicate rows.

### Elevated 5xx

API 500s are generic to clients; the real error is in Sentry/logs (`captureException`).
Use the `x-request-id` from the client to find the exact request. Roll back if a
recent deploy correlates (see below).

### Billing webhook failures

`/api/webhooks/stripe` verifies the signature and returns 500 on handler error so
**Stripe retries**. Replay failed events from the Stripe dashboard. Confirm
`STRIPE_WEBHOOK_SECRET` matches the endpoint. Org plan state lives on `orgs`.

### Auth / tenant issues

After changing a user's `app_metadata` (org assignment, self-serve org create),
the **JWT must refresh** before the change takes effect — the user re-logs in or
the client calls `supabase.auth.refreshSession()`.

## Secret rotation

Rotate on a schedule and on suspected exposure. All are server-side env vars
(Vercel project settings); no code change needed.

- **`CRON_SECRET`** — set the new value, redeploy. Cron callers use the env, so
  they pick it up automatically. Compared in constant time (`safeEqual`).
- **`SUPABASE_SERVICE_ROLE_KEY`** — rotate in Supabase → update env → redeploy.
- **API keys** (customer) — revoke from /admin (sets `revoked_at`); only the
  sha256 hash is stored, so a leak of the DB never exposes usable keys.
- **`STRIPE_WEBHOOK_SECRET` / `STRIPE_SECRET_KEY`** — roll in Stripe → update env.
- **`ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `SENTRY_*`, `UPSTASH_*`** — roll at the
  provider → update env → redeploy.

## Deploy & rollback

- Deploys go through Vercel; CI (`.github/workflows/ci.yml`) gates format,
  typecheck, lint, tests + coverage, build, and `pnpm audit` before merge.
- **Rollback:** promote the previous Vercel deployment (instant). Code is
  forward-only; DB migrations are additive + idempotent (`if not exists`), so a
  code rollback is safe against a newer schema.
- **Migrations** are applied manually in the Supabase SQL editor, in order. Never
  edit a shipped migration — add a new one.

## On-call checklist

- [ ] Sentry quiet? (no new unresolved issues)
- [ ] `GET /api/health?deep=1` → `200`, `db: "ok"`
- [ ] Latest cron runs succeeded (/admin), data fresh
- [ ] No spike in 429s (rate limits) or 5xx
