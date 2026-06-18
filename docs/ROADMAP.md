# Arbor Enhancement Roadmap

> Reference roadmap for evolving Arbor to commercial-grade without changing its
> core concept. Items tagged `[have]` (exists, refine) or `[add]` (net-new).

## Context

Arbor is a PE deal-lifecycle intelligence platform built on four layers — **Signal**
(what's happening in the market) → **Process** (what our team is doing about it) →
**Relationship** (who can get us access) → **Intelligence** (price + probability).
It is live at `arbor-peach.vercel.app` (Vercel Hobby; AI/email/rate-limit dormant;
crons trimmed to 2/day). The base is strong: all Tier 1–3 features + a full hardening
pass, plus recent work (radar-sort correctness, LLM prompt-injection guard + eval
harness, feature flags, LLM cost cap, pg_trgm search, CI modernization, header UX).

Goal: **enhance Arbor's own concept to commercial-grade — flawless to use and clearly
worth paying for** — without pivoting it into a different product. Build incrementally,
one item at a time, green-gate each (`pnpm format:check && tsc --noEmit && lint &&
test:coverage && build && test:e2e`), follow the project pattern: **pure logic in
`lib/*.ts` → thin route in `app/api/**`→ thin component**, add new pure libs to`vitest.config.ts`coverage include, add new pages to`e2e/a11y-audit.spec.ts`, mock-mode
support in `lib/mock-data.ts`.

---

## Tier 0 — Launch readiness (do first; blocks real paying users)

Mostly enablement/config, not big code. Without them the live app is unusable or empty
for a prospect.

1. **Fix auth** — Supabase → Auth → URL Configuration: Site URL
   `https://arbor-peach.vercel.app` + Redirect URLs allow-list (`…/**` + localhost).
   Today email-confirm bounces to `localhost:3000`; signup/login broken. Code already
   correct (`app/auth/callback/route.ts`, `app/signup/page.tsx`).
2. **Turn on prod integrations** (Vercel env → redeploy): `ANTHROPIC_API_KEY` (AI is the
   headline feature, dormant now), `RESEND_API_KEY`/`EMAIL_FROM` (invites, digests,
   confirmations), `UPSTASH_*` (rate-limit/lockout), `SENTRY_DSN`. Upgrade to **Vercel
   Pro** to restore the full 7-cron pipeline (`vercel.json`; schedule in `docs/DEPLOY.md §3`).
3. **Never-empty product** — enable Google CSE ingest (`lib/ingest/enrich.ts` + universe
   scan) so the radar fills; add a seeded demo dataset for first-run/sandbox.
4. **Public landing + pricing + demo** — `app/page.tsx` currently `redirect("/radar")`,
   so prospects hit login and see nothing. Add a marketing home, a pricing page (Stripe
   checkout/portal/webhooks already exist), and a read-only demo/sandbox.
5. **Prove tenancy + recovery** — RLS isolation E2E on a seeded staging DB (cross-org read
   returns 0 rows); verify Supabase PITR + one restore rehearsal; write rollback into
   `docs/RUNBOOK.md`.

---

## Tier 1 — Signal layer (deepen the moat: earliest + most trusted)

- `[add]` **Source expansion** (each a new `lib/ingest/<source>.ts` mirroring
  `lib/ingest/hsr.ts`, dormant-until-key): LinkedIn hiring spikes & exec departures, job
  postings, court/bankruptcy filings, patents, trade press, **debt-maturity walls** (refi
  pressure → sale signal), non-US regulators.
- `[add]` **Predictive "coming-to-market" score** — new `lib/predict-market.ts`: hold
  period + sector + sponsor pattern + debt maturity → flag assets before a formal
  process. Surface as a radar band/badge. Core differentiator.
- `[add]` **Source-credibility weighting + cross-outlet dedupe** — extend
  `lib/corroboration.ts`.
- `[add]` **Analyst feedback loop** — thumbs up/down on a signal feeds extraction tuning +
  confidence.
- `[add]` Per-company **data-freshness** indicator (reuse `lib/freshness.ts`).
- `[have]` momentum (`lib/signal-momentum.ts`), corroboration, conviction, confidence.

## Tier 2 — Process layer (run the deal inside Arbor)

- `[add]` **Deal rooms** — per-deal workspace (extend `app/company/[id]/page.tsx` or new
  `app/deals/[id]`) unifying signals + contacts + notes + bids + IC memo + key dates +
  docs. Biggest workflow upgrade.
- `[add]` **Document attachments** — upload teaser/CIM/financials (Supabase Storage),
  extract stated financials → feed comps/conviction. New `lib/documents.ts` + route.
- `[add]` **Tasks 2.0** — assignments, due dates, reminders, per-stage checklists (extend
  `lib/deal-tasks.ts` + `components/ui/DealWorkflowSection.tsx`).
- `[add]` Email/calendar capture → auto-log interactions to the deal timeline.
- `[add]` IC approval workflow + deal templates/playbooks; per-deal activity feed.
- `[have]` deal stages (`lib/process-stage.ts`), key dates, bids (`lib/bids.ts`), kanban.

## Tier 3 — Relationship layer (who gets us access)

- `[add]` **Relationship graph** — who-knows-whom + warm-intro paths (new
  `lib/relationship-graph.ts` over `contacts`/`company_contacts`).
- `[add]` **Coverage map** — sponsors/bankers we have ties to vs gaps.
- `[add]` **Banker deal-flow tracking** — which advisors bring which deals → rank by yield
  (extend `lib/contacts.ts` `bankerIntelligence`).
- `[add]` Outreach **cadences/sequences** + templated/AI-drafted; interaction logging →
  relationship-strength score.
- `[add]` Contact enrichment (titles, job moves) via a provider (dormant-until-key).
- `[have]` contacts directory, banker intelligence, advisor suggestions, outreach draft.

## Tier 4 — Intelligence layer (price + probability)

- `[add]` **Outcome-calibrated probability** — train `lib/conviction.ts` weights on
  win/loss (`lib/win-loss.ts`) for a real %-to-close; show calibration
  (`v_confidence_calibration`).
- `[add]` **Proprietary comps dataset** — lean into tracked outcomes → multiples no one
  else has (extend `lib/comps.ts`); durable moat.
- `[add]` **Valuation analytics** — EBITDA multiples by sector/time from extracted
  financials; benchmarking (hold periods, sector velocity, time-in-stage norms).
- `[add]` Predictive **timing-to-market + expected competition** on the card.
- `[have]` conviction, comps, sponsor analytics, IC memo (`lib/ic-memo.ts`), analytics views.

## Tier 5 — Cross-cutting AI (serving the radar, not a chatbot)

- `[add]` **Semantic search (pgvector)** for NL queries + smart saved searches (extend
  `lib/nl-search.ts`; embeddings table + retrieval).
- `[add]` **Noise-ranked alerts** — ML priority + dedupe; extend `lib/alert-rules.ts` +
  notify cron.
- `[add]` Portfolio-level Q&A with citations + sharp "what changed this week" briefing
  (extend `lib/memo.ts` + `lib/digest.ts`); guard with `lib/llm-eval.ts` +
  `lib/llm-safety.ts`.
- `[have]` keyword NL search, per-company Q&A + citations, digests, Slack/Teams, eval harness.

## Tier 6 — UX polish & premium feel (flawless)

- `[add]` **Loading skeletons** — no `loading.tsx` exists anywhere; add per route.
- `[add]` Empty states, optimistic UI, transitions/micro-interactions, mobile/responsive QA.
- `[add]` Onboarding that **fills the radar in <60s** (extend `app/onboard/page.tsx`).
- `[add]` Export to **PDF/Excel/PPT** (reuse `lib/report.ts`, `lib/csv.ts`); notifications
  center; custom dashboards.
- `[have]` CSV/print export, ⌘K palette, dark mode (avatar menu), PWA, saved views, docs portal.

## Tier 7 — Reliability / trust / enterprise

- `[add]` **Radar denormalization** — store cron-computed `companies.conviction_score` so
  `/api/companies` sorts/scales at the DB (the `lib/radar-rank.ts` cap is interim).
- `[add]` Live **Typesense** search (config referenced; not wired), audit-log viewer UI
  (data exists), **SOC 2 / security page** path.
- `[have]` Sentry, load tests, keyset pagination, circuit breaker, dead-letter, retries,
  idempotent ingest, feature flags, status page, SSO/SCIM/MFA, RLS, GDPR, CSP, Turnstile.

## Tier 8 — Commercial / GTM

- `[add]` Pricing page + **free trial** + usage metering + plan-gating UI (Stripe
  checkout/portal/webhooks + seats + dunning already exist).
- `[add]` Customer admin console, ROI/usage reporting, in-app support/chat, changelog,
  lifecycle emails.

---

## Non-code / business investments (flag, not buildable in-repo)

- SOC 2 Type II / ISO 27001 / pen test (process + $).
- Market-data licenses (PitchBook/CapIQ/Preqin) if pursued.
- Paid infra: Vercel Pro, Anthropic, Upstash, Resend, Stripe live, Google CSE.

---

## Recommended sequence (highest leverage, Arbor-true)

1. **Tier 0** launch readiness (auth, AI/email/data on, landing+pricing, backups/RLS).
2. **Signal source expansion + predictive "coming-to-market"** (Tier 1) — the moat.
3. **Deal rooms** (Tier 2) — unify the four layers in one workspace.
4. **Outcome-calibrated probability + proprietary comps** (Tier 4).
5. **Relationship graph** (Tier 3), then **UX polish** (Tier 6) throughout.

## Verification (per item)

- Unit-test new pure libs (add to `vitest.config.ts` coverage include); keep floors.
- New pages → add to `e2e/a11y-audit.spec.ts` (WCAG AA), keep mock-mode rendering.
- Run the full green gate before each commit; commit on `main` only when told.
- Smoke-test on the live deploy (`/api/health?deep=1`) after enabling prod integrations.
