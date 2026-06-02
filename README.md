# Arbor

Live intelligence platform tracking companies moving through private-equity deal
lifecycles (carveouts + private assets), organized by sector.

**Current build: complete frontend on mock data.** No Supabase, auth, pipelines,
search, Redis, or realtime yet — every page runs entirely from `lib/mock-data.ts`
and needs zero external services or environment variables.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS — flat, minimal, light theme; Inter (400/500 only)
- Recharts (analytics)
- pnpm

## Run

```bash
pnpm install
pnpm dev      # http://localhost:3000 → redirects to /radar
pnpm build    # production build (type-check + lint); all routes prerender
```

> Node isn't required to be globally installed — any Node 18.17+ works. pnpm via
> `corepack enable && corepack prepare pnpm@latest --activate`.

## Routes

| Route | Description |
|-------|-------------|
| `/` | redirects to `/radar` |
| `/radar` | Kanban radar — sector pills, deal-type toggle, debounced search (all client-side) |
| `/feed` | Activity feed grouped by day + sidebar (live, watchlist, weekly summary) |
| `/analytics` | Metric cards + Recharts (velocity, deal split, stage-by-sector, funnel, top sectors) |
| `/company/[id]` | Profile — timeline, key signals, analyst notes, sector peers (try `/company/1…24`) |
| `/review` | Analyst review queue — Confirm / inline Override modal |
| `/admin` | Pipeline health + system stats + users table |

Top nav (Radar / Feed / Analytics) lives in `components/layout/AppLayout.tsx`;
`/review` and `/admin` are reachable by URL.

## Design system

Flat and minimal: white card surfaces, 0.5px hairline borders, no shadows or
gradients, Inter at weights 400/500 only. Exact badge/stage hex values live in
`lib/colors.ts` (applied via inline styles for fidelity).

## Project layout

```
app/
  layout.tsx                 AppLayout wrapper + Inter font
  page.tsx                   redirect → /radar
  radar | feed | analytics | review | admin /page.tsx
  company/[id]/page.tsx      generateStaticParams over all mock companies
components/
  ui/                        badges, cards, kanban, timeline, modal, etc.
  layout/                    AppLayout, PageHeader
lib/
  types.ts                   all TypeScript types
  colors.ts                  exact design-system color/label maps
  mock-data.ts               all mock data (companies, history, signals, notes, feed, …)
  format.ts                  date / className helpers
supabase/                    SQL schema + seed (kept for the future backend pass)
```

## Not built yet (intentionally)

Supabase client & DB calls, auth/protected routes, ingestion pipelines, Typesense
search, Redis, realtime subscriptions, and any env-var dependencies. The
`supabase/` SQL from the earlier backend spike is retained for the next pass.
