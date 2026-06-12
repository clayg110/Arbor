# Arbor — Claude Code Project Memory

This file is the single source of truth for continuing Arbor development across machines.
Claude Code reads it automatically at session start.

---

## Who is the user

Ashwin (ashwinsinghofficial@gmail.com). Solo founder building Arbor — PE deal-lifecycle
intelligence platform. Not a beginner. Works fast, wants direct answers, no filler.

---

## Hard rules (read first, follow always)

### Commit/push only when told

NEVER auto-commit after finishing work. Build + verify → leave changes uncommitted → wait
for an explicit "commit" or "push". When told to commit: directly on `main`, no feature branch,
no Claude co-author footer. User is the sole git author.
**Why:** User said "don't commit to github everytime. only when I tell you."

### Green gate before every commit

`pnpm format:check && pnpm tsc --noEmit && pnpm lint && pnpm test:coverage && pnpm build && pnpm test:e2e`
Coverage floors (vitest.config.ts thresholds — never lower): lines 65, functions 48, statements 65, branches 55.
All 613 unit + 26 E2E must pass.

### Node/pnpm setup

**Linux (Mint):** Node v24 via system package, pnpm 11 via `npm install -g pnpm@11`. Both on PATH — no export needed.

**Windows (winget):** Node not on PATH. Prepend at start of every shell session:

```
export PATH="C:/Users/clayg/AppData/Local/Microsoft/WinGet/Packages/OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe/node_modules/.bin:$PATH"
```

In PowerShell: `$env:PATH = "C:\Users\clayg\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node_modules\.bin;$env:PATH"`

pnpm 11 quirks:

- Build-script approval in `pnpm-workspace.yaml` (`allowBuilds`), not package.json.
- `.npmrc` has `verify-deps-before-run=false` so `pnpm build` doesn't re-run install.

Playwright browsers are NOT in `node_modules` — install once per machine with
`pnpm exec playwright install chromium` or `pnpm test:e2e` fails with
"Executable doesn't exist at …/chromium_headless_shell".

### .next cache corruption

Symptom: `TypeError: __webpack_modules__[moduleId] is not a function`.
Fix: `rm -rf .next` then restart dev server.

---

## Current state (resume here)

**As of 2026-06-12:**

- ALL 8 phases + full backlog (hardening + @mention + landing page) DONE + green. **COMMITTED.**
- Tier 1, Tier 2, Tier 3 — **ALL features DONE + green + COMMITTED + PUSHED.** Roadmap fully cleared.
- 613 unit tests, 26 E2E, prod build all passing.
- Migration counter: **next is 0042** (last used: 0041 = crm_sync).
- **Remaining work is go-live ops, not code** — see `docs/DEPLOY.md`. Migrations 0035–0041 are committed but NOT yet applied to the live DB; several integration keys are unset (dormant). Nothing left to build.

**What was built in the latest commit (`0d20a69`, Tier 3 batch — pushed 2026-06-12):**

1. **Calendar subscription feed** — `lib/calendar.ts` (RFC-5545), `lib/calendar-token.ts` (HMAC), `/api/calendar/[token].ics` + `/api/calendar/feed`, settings card. Dormant without `CALENDAR_FEED_SECRET`.
2. **LP / fund-level reporting** — migration 0040 (`funds` + `companies.fund_id`), `lib/lp-report.ts`, `lib/adapters/funds.ts`, `/api/funds` CRUD + `/api/reports/lp`, `/reports/lp` page, `FundPickerSection`, nav link.
3. **CRM sync (Affinity)** — migration 0041 (`crm_sync`), `lib/crm/*`, `/api/companies/[id]/crm-sync`, `CrmSyncSection`. Dormant without `AFFINITY_API_KEY`.
4. **Enrich-on-add** — `lib/ingest/enrich.ts`, fired via `after()` from POST `/api/companies`. Dormant without Google CSE.
5. **Multi-source corroboration** — `lib/corroboration.ts`, wired into `lib/ingest/persist.ts` (≥3 distinct sources auto-promote to `high`).
6. **`noUncheckedIndexedAccess`** enabled; **E2E reliability fix** in `playwright.config.ts` (cold-compile headroom, capped workers, retry-once).

Tier 2 batch (Bid Tracker, Partner Dashboard, HSR, Signal Timeline, Comps filter) shipped in the prior commit `af2c1a2`.

**The 8-phase feature roadmap (all done):**

1. Conviction score — `lib/conviction.ts`, migration 0022, `v_company_conviction`, `ConvictionBadge`
2. AI deal memo + Q&A — `lib/memo.ts`, migration 0023, `AiBriefing.tsx`, `/api/companies/[id]/memo` + `/ask`
3. Custom alert rules — `lib/alert-rules.ts`, migration 0024, `AlertsSection.tsx`, notify cron, webhook fan-out
4. Sponsor analytics + comps — `lib/comps.ts`, migrations 0025–0027, `OutcomeForm.tsx`, new analytics panels
5. Proactive delivery — saved searches → alerts, Slack/Teams delivery, briefing email, CSV export, print view
6. Search & discovery — `lib/nl-search.ts`, saved views migration 0029, `/api/radar/suggestions`, `SuggestionsBar`

**Hardening passes (all done):**

- Security: timing-safe secrets (`safeEqual`), API-key scopes, COOP header, CSP nonce in middleware, Dependabot/CodeQL, SECURITY.md, 2FA/TOTP, Turnstile bot protection, login brute-force lockout
- Observability: `x-request-id` via AsyncLocalStorage, structured logs, `withObservedRoute` HOF, Sentry source maps + tracing spans, public `/status` page
- Performance: keyset cursor pagination (`lib/pagination.ts`), covering indexes migration 0017, `cached()` read helper
- Pipeline: shared retry (`lib/retry.ts`), idempotent ingest via dedupe_key (migration 0018), freshness SLA cron, circuit breaker + dead-letter, admin replay UI
- Multi-tenant: org_id in JWT app_metadata, team invite via generateLink, seat metering, SSO (domain-based), SCIM 2.0 provisioning
- Billing: Stripe checkout/portal/webhooks, plan-gated API limits, dunning emails on past_due transition
- Public launch: legal pages, GDPR data rights (export/delete), cookie notice, a11y (axe zero-violations), SEO (metadata routes, OG image), PWA manifest + service worker, onboarding flow, command palette, dark mode toggle, docs portal
- Load tests: `scripts/load/run.mjs` (dependency-free) + `k6.js`

---

## Architecture

**Stack:** Next.js 15 App Router, Supabase (PostgreSQL + Auth + RLS), TypeScript, Tailwind, Recharts, Vitest, Playwright.

**Project path:** `B:\Projects\Arbor` (Windows) / `/home/seraphim/Coding/VSCode/Arbor` (Linux Mint)

**Pattern:** Pure logic in `lib/*.ts` → thin route handlers in `app/api/**` → thin components. Never put business logic in routes or components.

**Dormant-until-key:** Every integration (Anthropic, Resend, Stripe, Slack, Upstash, Sentry, Turnstile) no-ops gracefully when its env var is absent. App is fully usable in mock mode.

**Mock mode:** No `NEXT_PUBLIC_SUPABASE_URL` → middleware skips auth, pages render from `lib/mock-data.ts`. E2E tests run in mock mode.

**Multi-tenant:** `org_id` in `app_metadata` (JWT). Service client bypasses RLS — any service-client query in a cron MUST filter by `org_id` explicitly. `getSessionUser()` in `lib/api/auth.ts` extracts `orgId` from the JWT.

**Auth pattern:** `createClient()` (user-scoped, RLS enforced) for user actions. `createServiceClient()` (service role) ONLY for cron, admin routes, or cross-user writes (e.g., notifications).

---

## Supabase typed client gotcha

Row types in `types/db.ts` MUST be `type X = {...}`, NOT `interface X`. Using `interface` silently collapses all `Update`/`Insert` types to `never` (supabase-js v2 constraint: `Record<string, unknown>`). Each table also needs `Relationships: []`.

---

## Testing conventions

- Vitest, node env default. jsdom per-file: `// @vitest-environment jsdom` docblock.
- Route tests mock `@/lib/supabase/server` inline (vi.mock hoisted, factory uses only globalThis). Shared fakes: `tests/helpers/sb.ts` (`makeClient`, `installClient`, `fakeUser`).
- New pure lib files → add to `vitest.config.ts` `coverage.include`. LLM I/O boundaries (`lib/memo.ts`, `lib/extract-signal.ts`) are EXCLUDED from coverage (E2E scope).
- `pnpm lint` = `eslint . --ext .ts,.tsx --max-warnings 0`. No warnings tolerated.
- E2E: Playwright + axe. New pages → add to `e2e/a11y-audit.spec.ts` PAGES array. WCAG AA required everywhere (min 4.5:1 contrast). AA palette: green `#157A5A`, amber `#8A5712`, red `#C0322F`.

---

## Color / a11y palette

- Primary blue: `#185FA5`
- Green (positive): `#157A5A` (NOT `#1D9E75` — fails AA on light backgrounds)
- Amber: `#8A5712`
- Red: `#C0322F`
- Text muted: `var(--text-muted)` = `#5f5e57`
- Text subtle: `var(--text-subtle)` = `#6a6963`
- Never lighten the gray tokens without re-checking axe.

---

## Key files map

| File                         | Purpose                                                           |
| ---------------------------- | ----------------------------------------------------------------- |
| `lib/types.ts`               | Core domain types (RadarCompany, Stage, Signal, etc.)             |
| `types/db.ts`                | Supabase row types (must be `type`, not `interface`)              |
| `lib/mock-data.ts`           | Mock data for demo/E2E mode                                       |
| `lib/api-client.ts`          | Client-side fetch wrappers (all API calls from components)        |
| `lib/api/auth.ts`            | `SessionUser`, `getSessionUser()`                                 |
| `lib/api/respond.ts`         | `ok()`, `fail()`, `requireBackend()`, `serverError()`, `cached()` |
| `lib/adapters/company.ts`    | `toRadarCompany(row, lastSignal?, watched?, agg?)`                |
| `lib/notifications.ts`       | `upsertNotificationRows`, `NotificationRow` shape                 |
| `lib/alerts.ts`              | `sendEmail`, `sendSlackAlert`, `sendTeamsAlert`, `sendAllAlerts`  |
| `lib/mentions.ts`            | `nameToHandle`, `extractMentionHandles`, `resolveHandles`         |
| `lib/process-stage.ts`       | Internal deal process stages, labels, colors, strip summary       |
| `lib/contacts.ts`            | Contact roles, `bankerIntelligence`, `suggestAdvisorsFromSignals` |
| `lib/ic-memo.ts`             | Structured IC memo: sections, context, parse, markdown (LLM)      |
| `lib/supabase/middleware.ts` | Auth redirect logic, PUBLIC paths list                            |
| `middleware.ts`              | Root: request-id, CSP nonce, matcher config                       |
| `vitest.config.ts`           | Coverage includes + thresholds                                    |
| `supabase/migrations/`       | SQL migrations, next counter is 0042                              |

---

## Migration convention

Files: `supabase/migrations/NNNN_slug.sql`. Next number is **0042**.
Used through 0041 (0022=conviction, 0023=company_memos, 0024=alert_rules, 0025=sponsor_holding, 0026=outcomes, 0027=calibration, 0028=user_preferences, 0029=saved_views, 0030=deal_workflow, 0031=alert_email_delivery, 0032=analytics_views, 0033=report_prefs, 0034=outreach_log_update_policy, 0035=deal_process_stage, 0036=contacts, 0037=company_contacts, 0038=company_ic_memos, 0039=deal_bids, 0040=funds, 0041=crm_sync).

---

## Public/bare path sync

Two lists MUST stay in sync when adding public routes:

1. `lib/supabase/middleware.ts` → `PUBLIC` array (auth bypass)
2. `components/layout/AppLayout.tsx` → `BARE_PATHS` array (no app chrome)

---

## Cron security

All cron routes in `app/api/cron/` require `Authorization: Bearer <CRON_SECRET>` (compared via `safeEqual`, not `===`). `api/cron` is in the middleware matcher exclusion (no session cookie needed). `api/ingest` also excluded.

---

## Remaining work

**Feature roadmap fully cleared — Tier 1, 2, 3 all DONE + committed + pushed. Zero TODO/FIXME in code.**
What's left is **go-live ops, not coding** — see `docs/DEPLOY.md`:

- Apply migrations 0035–0041 to the live Supabase (one-paste bundle: `docs/go-live-migrations.sql`).
- Set core prod env (Supabase, `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`, `ANTHROPIC_API_KEY`).
- Set dormant keys to light up features: `RESEND_API_KEY`/`EMAIL_FROM` (email), `CALENDAR_FEED_SECRET`, `AFFINITY_API_KEY`, `HSR_SOURCE_URL`, Turnstile, Sentry, Stripe.
- Deploy via Vercel (push to `main`), then smoke-test `GET /api/health?deep=1`.

Feature inventory below is historical (all shipped).

### Tier 1 — ✅ ALL DONE

1. **Deal Process Stage Tracker** — DONE (migration 0035). `lib/process-stage.ts`, `ProcessStageSection.tsx`, `/api/companies/[id]/process-stage` + `/key-dates`, "Our Process" kanban + summary strip on radar.
2. **Contact / Banker Relationship Manager** — DONE (migrations 0036–0037). `lib/contacts.ts`, `CompanyContactsSection.tsx`, `/api/contacts`, `/contacts` page (directory + banker intelligence tab).
3. **Structured IC Memo Generator** — DONE (migration 0038). `lib/ic-memo.ts`, `IcMemo.tsx`, `/api/companies/[id]/ic-memo` (POST, cached). 8 structured sections + Copy as Markdown + Download .md.

### Tier 2 — High value, clear scope (ALL DONE — COMMITTED)

1. **Bid / Offer Tracker** — DONE (migration 0039). `lib/bids.ts`, `BidTrackerSection.tsx`, `/api/companies/[id]/bids`, `/api/companies/[id]/bids/[bidId]`.
2. **Pipeline-Level Partner Dashboard** — DONE. `lib/pipeline.ts`, `app/pipeline/page.tsx`, `/api/pipeline`. Funnel viz, upcoming dates, team workload, sector concentration.
3. **Regulatory Filing Tracker (HSR/FTC)** — DONE. `lib/ingest/hsr.ts`, `/api/ingest/hsr`, `hsr_filing` SourceType, `hsr_filed` FeedEventType. Daily cron at 06:00. Dormant without `HSR_SOURCE_URL`.

### Tier 3 — Good, lower priority

- **Per-Company Signal Timeline** — DONE. `lib/signal-timeline.ts`, `SignalTimeline.tsx`. Horizontal 12-month dot timeline on company profile above Key Signals.
- **Comps Database Filter UI** — DONE. `CompsSection.tsx`. Sector/size/type/outcome/date filters + CSV export. Replaced static list on company profile.
- **Calendar Sync (Google/Outlook)** — DONE. ICS subscription feed (read-only, one-way). `lib/calendar.ts` (RFC-5545 builder + `gatherDealEvents`), `lib/calendar-token.ts` (stateless HMAC token, dormant until `CALENDAR_FEED_SECRET`), `/api/calendar/[token].ics` (service-client feed of a user's task due dates + process key dates + bid dates), `/api/calendar/feed` (signed subscription URL for UI), "Calendar subscription" card in `/settings`. No migration (stateless token). Subscribe via "add calendar from URL" in Google/Outlook/Apple.
- **Automatic Company Enrichment on Add** — DONE. `lib/ingest/enrich.ts` (`enrichCompanyOnAdd`): on manual add, POST `/api/companies` schedules a targeted Google CSE search via `after()` (post-response, instant add), feeding the same extract→resolve→persist pipeline. Carve-outs → divestiture query, private-asset → sale-process query. Dormant without Google CSE env. No migration.
- **LP / Fund-Level Reporting** — DONE. Migration 0040 (`funds` table, org-scoped RLS + `companies.fund_id` FK ON DELETE SET NULL). `lib/lp-report.ts` (`buildLpReport`/`lpReportToCsv`/quarter helpers, pure), `lib/adapters/funds.ts`. APIs: `/api/funds` (CRUD), `/api/funds/[id]`, `/api/reports/lp?quarter=&format=csv`, company PATCH `assign_fund` action. `/reports/lp` page (quarter selector, per-fund snapshot cards, fund manager, CSV download), `FundPickerSection` on company profile, "LP Report" nav link. Mock-mode via `mockFunds`/`mockLpReport`.
- **CRM sync (Affinity / DealCloud / Salesforce)** — DONE (Affinity provider; others slot into the same interface). Migration 0041 (`crm_sync` table, org-scoped RLS, unique per company+provider). `lib/crm/map.ts` (pure `toCrmOrg`/`crmNoteText`/`domainFromWebsite`, tested), `lib/crm/provider.ts` (`CrmProvider` interface), `lib/crm/affinity.ts` (one-way push: org + note, dormant without `AFFINITY_API_KEY`), `lib/crm/index.ts` (`getCrmProvider`/`hasCrmEnv`/`crmProviderLabel`). `/api/companies/[id]/crm-sync` (GET status / POST push, upserts crm_sync). `CrmSyncSection` on company profile. One-way export for now.
- **Multi-source corroboration** — DONE. `lib/corroboration.ts` (`corroboratedConfidence`, `distinctSourceCount`, `CORROBORATION_THRESHOLD=3`). In `lib/ingest/persist.ts` matched path: counts distinct source types in the 30-day window (incl. the new signal); ≥3 independent sources auto-promote confidence to `high`, overriding a single low-quality signal's flag. No migration.
- **`noUncheckedIndexedAccess`** — DONE. Enabled in `tsconfig.json`; fixed 168 resulting errors across lib/app/components/tests (guards + non-null assertions on provably-safe index access). tsc clean with the flag on.

### What these unlock together

Four layers of a complete PE deal OS:

1. **Signal layer** (existing) — What's happening in the market
2. **Process layer** (new, feature 1) — What is our team doing about it
3. **Relationship layer** (new, feature 2) — Who do we know who can get us access
4. **Intelligence layer** (existing + feature 3) — What does the data say about price and probability

No competitor has all four.

---

## Env vars reference

```
# Required for live mode
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Optional integrations (dormant without key)
ANTHROPIC_API_KEY=        # AI memo, Q&A, outreach draft
RESEND_API_KEY=           # Email (invites, digests, reports)
EMAIL_FROM=               # e.g. noreply@arbor.ai
STRIPE_SECRET_KEY=        # Billing
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_PRO=
STRIPE_PRICE_ENTERPRISE=
UPSTASH_REDIS_REST_URL=   # Login lockout, rate limiting
UPSTASH_REDIS_REST_TOKEN=
SLACK_WEBHOOK_URL=        # Alert delivery
TEAMS_WEBHOOK_URL=        # Alert delivery
SENTRY_DSN=               # Error tracking
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=  # Bot protection
TURNSTILE_SECRET_KEY=
CRON_SECRET=              # Secures /api/cron/* routes
NEXT_PUBLIC_APP_URL=      # e.g. https://app.arbor.ai
HSR_SOURCE_URL=           # FTC HSR filing JSON endpoint (dormant without; e.g. https://efts.ftc.gov/LATEST/search-index)
CALENDAR_FEED_SECRET=     # HMAC secret for the ICS calendar subscription feed (dormant without)
AFFINITY_API_KEY=         # Affinity CRM API key for one-way deal push (dormant without)

# Alerts/notify webhook (deprecated — use SLACK/TEAMS above)
ALERT_WEBHOOK=
```
