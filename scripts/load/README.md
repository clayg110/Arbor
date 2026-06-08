# Load tests

Two ways to load-test Arbor's read paths. Both default to public endpoints
(`/api/health`, `/api/status`, `/landing`) so they run with **no keys**; supply
`API_KEY` / `COOKIE` to also exercise the keyed and authenticated read paths.

Start the app first (or point `BASE_URL` at a deployed environment):

```bash
pnpm build && pnpm start        # or: pnpm dev
```

## 1. `pnpm load` — zero-dependency runner

Uses Node's global `fetch` + a fixed worker pool. No external tool to install.

```bash
pnpm load
BASE_URL=https://arbor.example.com CONCURRENCY=50 DURATION_S=30 pnpm load
API_KEY=ak_live_… pnpm load          # adds GET /api/v1/companies
COOKIE="sb-access-token=…" pnpm load  # adds GET /api/feed + /api/search
```

Per-target it prints `req/err/rps/p50/p95/p99/max` and **exits non-zero** if any
target breaches the budget (defaults: p95 < 500ms, p99 < 1000ms, errors < 1%).
Override with `LOAD_P95` / `LOAD_P99` / `LOAD_ERR` (the last is a fraction, e.g.
`0.02` for 2%).

## 2. `pnpm load:k6` — k6 (standard tooling)

Install [k6](https://k6.io/docs/get-started/installation/) for heavier / ramped /
distributed runs. Same thresholds gate the run (it exits non-zero on a breach):

```bash
k6 run scripts/load/k6.js
BASE_URL=https://arbor.example.com VUS=50 API_KEY=ak_live_… k6 run scripts/load/k6.js
```

## Notes

- These hit **read** endpoints only — they don't write data or trigger
  ingestion/LLM calls, so they're safe against a staging deployment.
- `scripts/load/budget.mjs` holds the pure percentile + pass/fail math (shared by
  the runner, unit-tested in `tests/loadtest.test.ts`).
- Getting a `COOKIE`: sign in via the browser and copy the `sb-…` auth cookies
  from devtools (or a login response). Treat it as a secret.
