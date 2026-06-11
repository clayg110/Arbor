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
All 431 unit + 24 E2E must pass.

### Node/pnpm not on PATH

Node installed via winget. Prepend this to PATH at the start of every shell session:
`C:\Users\clayg\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node_modules\.bin`

In Bash: `export PATH="C:/Users/clayg/AppData/Local/Microsoft/WinGet/Packages/OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe/node_modules/.bin:$PATH"`

pnpm 11 quirks:

- Build-script approval in `pnpm-workspace.yaml` (`allowBuilds`), not package.json.
- `.npmrc` has `verify-deps-before-run=false` so `pnpm build` doesn't re-run install.

### .next cache corruption

Symptom: `TypeError: __webpack_modules__[moduleId] is not a function`.
Fix: `Remove-Item -Recurse -Force .next` then restart dev server.

---

## Current state (resume here)

**As of 2026-06-11:**

- ALL 8 phases + full backlog (hardening + @mention + landing page) DONE + green.
- Changes are **UNCOMMITTED** — waiting for user commit approval.
- 431 unit tests, 24 E2E, prod build all passing.
- Migration counter: **next is 0035** (last used: 0034 = outreach_log_update_policy).

**What was just built (uncommitted):**

1. **@mention resolution (Medium)** — `lib/mentions.ts` (pure: nameToHandle, extractMentionHandles, resolveHandles, tested), `app/api/orgs/members/route.ts` (GET, non-admin, returns org member handles for autocomplete), autocomplete dropdown in `DealWorkflowSection.tsx` (type `@` → dropdown, arrow/enter/tab/esc, `onMouseDown` keeps focus), mention notifications in outreach POST (fire-and-forget: resolves handles via auth.admin.listUsers, `upsertNotificationRows` with type="mention").
2. **Landing page wiring (Small)** — `lib/supabase/middleware.ts`: unauthenticated `/` → `/landing.html` (static marketing page); all other protected paths still → `/login?redirectTo=…`. Mock mode unaffected (middleware returns early before auth check).

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

**Project path:** `B:\Projects\Arbor`

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
| `lib/supabase/middleware.ts` | Auth redirect logic, PUBLIC paths list                            |
| `middleware.ts`              | Root: request-id, CSP nonce, matcher config                       |
| `vitest.config.ts`           | Coverage includes + thresholds                                    |
| `supabase/migrations/`       | SQL migrations, next counter is 0035                              |

---

## Migration convention

Files: `supabase/migrations/NNNN_slug.sql`. Next number is **0035**.
Used through 0034 (0022=conviction, 0023=company_memos, 0024=alert_rules, 0025=sponsor_holding, 0026=outcomes, 0027=calibration, 0028=user_preferences, 0029=saved_views, 0030=deal_workflow, 0031=alert_email_delivery, 0032=analytics_views, 0033=report_prefs, 0034=outreach_log_update_policy).

---

## Public/bare path sync

Two lists MUST stay in sync when adding public routes:

1. `lib/supabase/middleware.ts` → `PUBLIC` array (auth bypass)
2. `components/layout/AppLayout.tsx` → `BARE_PATHS` array (no app chrome)

---

## Cron security

All cron routes in `app/api/cron/` require `Authorization: Bearer <CRON_SECRET>` (compared via `safeEqual`, not `===`). `api/cron` is in the middleware matcher exclusion (no session cookie needed). `api/ingest` also excluded.

---

## Remaining work (nothing built yet)

Nothing below is built. Build in the recommended order when user asks.

### Tier 1 — Build first (highest impact, most differentiating)

**1. Deal Process Stage Tracker** ★★★ — M/L
The #1 gap. Radar tracks the _market's_ stage. PE teams need to track _their own_ process stage. This is the spreadsheet killer.

- New `our_process_stage` column on `companies` (nullable): `watching → teaser_received → nda_signed → cim_received → first_round_bid → management_presentation → second_round_bid → exclusivity → loi_signed → due_diligence → won | passed`
- Milestone log: every stage change stamped with date + author (like `deal_stage_history` but internal)
- Key dates per stage (e.g. "Bids due: June 25") — editable inline
- Second kanban view on radar: "View by: Our Process"
- Process summary strip: "5 NDAs · 2 First-round bids due · 1 In exclusivity"
- Migration 0035

**2. Contact / Banker Relationship Manager** ★★★ — M/L
PE is a relationship business. No structured contact layer exists anywhere — advisors only appear as quoted text in signals.

- New `contacts` table: `id, name, title, firm, email, phone, linkedin_url, notes, created_at` — migration 0036
- Join table `company_contacts`: `company_id, contact_id, role (M&A Advisor | CFO | CEO | Partner | Counsel | Other)` — migration 0037
- "Advisors & Key Contacts" section on company profile page
- Contact directory page (`/contacts`) — filterable by firm, role
- Auto-suggest: LLM already extracts banker names from signals (e.g. "Goldman Sachs engaged as advisor") → offer to create contact
- Bonus: Banker Intelligence view — "Which banks are running the most processes in industrials?" (group company_contacts by firm where role=M&A Advisor)

**3. Structured IC Memo Generator** ★★★ — M
Current AI memo (`lib/memo.ts`) is free-form text. IC memos have defined sections.

- New structured prompt in `lib/memo.ts` (or `lib/ic-memo.ts`) producing: Executive Summary · Business Description · Investment Thesis · Key Risks · Comparable Transactions · Process Status (pulls `our_process_stage`) · Conviction & Signals · Recommendation
- Route: `POST /api/companies/[id]/ic-memo` (cached like existing memo)
- UI: "Generate IC Memo" button → formatted card + "Copy as Markdown" + "Download" (browser `window.print()` + print CSS, no external dep)

### Tier 2 — High value, clear scope

**4. Bid / Offer Tracker** ★★ — S/M
Record actual bids. Builds proprietary pricing benchmarks over time.

- New `deal_bids` table: `id, company_id, user_id, org_id, bid_type (indicative|final), bid_date, amount_usd?, multiple_on_ebitda?, round (1|2|final), rationale?` — migration 0038
- Requires Deal Process Stage Tracker (feature 1) to be contextually useful
- Analytics: avg multiple bid per sector, win rate vs bid price

**5. Pipeline-Level Partner Dashboard** ★★ — M
Distinct from `/analytics` (market-wide). Shows _the team's_ active pipeline.

- Only companies where `our_process_stage` is set
- Funnel viz per process stage, time-in-stage per deal, upcoming key dates
- Team workload (deals per owner), sector concentration of active processes
- Requires Deal Process Stage Tracker (feature 1)

**6. Regulatory Filing Tracker (HSR/FTC)** ★★ — M
HSR filings = public disclosure a transaction ≥$119M is occurring. Highest-confidence deal signal.

- New source type: `hsr_filing` (add to `SourceType` enum)
- Ingest route: `POST /api/ingest/hsr` — pulls FTC public HSR data
- LLM extraction matches to companies in tracker
- On match: auto-bump confidence to `high`, emit `hsr_filed` event type

**7. LinkedIn Hiring Signal Expansion** ★★ — M
Most-used manual PE signal. "CFO role open" = management change; "Integration Manager" = post-close; "10+ VP hires" = growth toward exit.

- New source type: `linkedin_hiring`
- Ingest via LinkedIn Jobs API or Proxycurl/Apify — gated on `LINKEDIN_API_KEY` env var
- Existing `processItem` pipeline handles extraction from there

### Tier 3 — Good, lower priority

- **Per-Company Signal Timeline** — Visual horizontal timeline (last 12 months, dots by source type). Mostly visualization upgrade on existing data. S.
- **Comps Database Filter UI** — Date range, deal size, sector filters + CSV export on existing comps. Builds on `lib/comps.ts`. S/M.
- **Calendar Sync (Google/Outlook)** — Deal milestones + task due dates → calendar events via CalDAV/Google Calendar API. S.
- **Automatic Company Enrichment on Add** — When analyst adds a company manually, trigger background signal search immediately (instead of waiting for next cron run). S.
- **LP / Fund-Level Reporting** — One-click quarterly pipeline snapshot filtered by fund vintage/sector. Enterprise tier feature. M.
- **CRM sync (Affinity / DealCloud / Salesforce)** — L, per-CRM key. Enterprise stickiness.
- **Multi-source corroboration** — Auto-bump confidence when N independent sources agree. S.
- **`noUncheckedIndexedAccess`** — ~54 tsc errors if enabled (array-index in pages). Separate pass.

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

# Alerts/notify webhook (deprecated — use SLACK/TEAMS above)
ALERT_WEBHOOK=
```
