# Contributing

## Setup

```bash
pnpm install
pnpm dev            # http://localhost:3000 — runs in mock mode with no env
```

Node 22 (see `.nvmrc`). Copy `.env.local.example` → `.env.local` to enable any
backend subsystem; each is independently optional.

## Scripts

```bash
pnpm dev            # dev server
pnpm build          # production build
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint (max-warnings 0)
pnpm format         # prettier --write
pnpm test           # vitest (unit + route)
pnpm test:coverage  # vitest + coverage gate
pnpm test:e2e       # Playwright (mock mode; installs chromium on first run)
```

## Quality gates

CI (`.github/workflows/ci.yml`) runs format-check, typecheck, lint, tests +
coverage, build, and `pnpm audit` on every PR; a separate job runs E2E.
A husky pre-commit hook runs Prettier + ESLint on staged files. Keep all green.

- **Tests:** colocated in `tests/` (vitest) and `e2e/` (Playwright). Pure logic
  in `lib/` should be unit-tested; route handlers get gating + happy-path tests
  using the Supabase mock in `tests/helpers/sb.ts`. Coverage has a ratchet floor
  — raise it, never lower it.
- **Style:** Prettier + ESLint are authoritative. No `any`, no `@ts-ignore`, no
  stray `console` (use `lib/logger`).

## Database changes

Add a new, additive, idempotent migration in `supabase/migrations/` (`NNNN_*.sql`,
`create … if not exists`). Never edit a shipped migration. Mirror new columns in
`types/db.ts` (row shapes are `type`, not `interface`).

## Adding an API route

1. `requireBackend()` first (mock-mode `503`).
2. Authenticate (`getSessionUser` / `requireAdmin` / API key) and authorize.
3. Validate input with Zod (`parseJson`); sanitize filter values (`safeFilterValue`).
4. Use `serverError(e)` for 500s (generic to client, captured server-side).
5. Consider wrapping with `withObservedRoute` for request-id + access logging.

## Commits

Conventional, imperative subjects (e.g. `Add freshness SLA cron`). PRs should be
green in CI before review.
