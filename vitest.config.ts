import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  // Components use the automatic JSX runtime (no `import React`). The React
  // plugin transforms .tsx the way Next does, so RTL can render them and the
  // bundler ignores tsconfig's `jsx: preserve`.
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    globals: true, // registers RTL's afterEach(cleanup) so jsdom DOM doesn't leak between tests
    environment: "node", // component tests opt into jsdom via a per-file docblock
    setupFiles: ["tests/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      // Gate the unit-testable business-logic core: adapters, API helpers,
      // validation, keys/audit/alerts/observability, and the pure persistence
      // helpers. I/O boundaries (Supabase/Redis clients, external HTTP fetchers,
      // the LLM extractor, the realtime hook) and interactive components are
      // integration/E2E scope, not unit targets, so they're excluded from the
      // coverage metric rather than dragging it into vanity territory.
      include: [
        "lib/adapters/**",
        "lib/api/**",
        "lib/safe-url.ts",
        "lib/alerts.ts",
        "lib/api-keys.ts",
        "lib/billing.ts",
        "lib/email.ts",
        "lib/validation.ts",
        "lib/observability.ts",
        "lib/logger.ts",
        "lib/format.ts",
        "lib/pagination.ts",
        "lib/security.ts",
        "lib/retry.ts",
        "lib/dedupe.ts",
        "lib/freshness.ts",
        "lib/request-context.ts",
        "lib/api/observe.ts",
        "lib/openapi.ts",
        "lib/circuit.ts",
        "lib/ingest/deadletter.ts",
        "lib/ingest/pipeline.ts",
        "lib/retention.ts",
        "lib/digest.ts",
        "lib/notifications.ts",
        "lib/seats.ts",
        "lib/sso.ts",
        "lib/scim.ts",
        "lib/csp.ts",
        "lib/mfa.ts",
        "lib/trace.ts",
        "lib/turnstile.ts",
        "lib/lockout.ts",
        "lib/csv.ts",
        "lib/status.ts",
        "lib/conviction.ts",
        "lib/calibration.ts",
        "lib/predict-market.ts",
        "lib/radar-rank.ts",
        "lib/theme.ts",
        "lib/llm-safety.ts",
        "lib/llm-eval.ts",
        "lib/llm-budget.ts",
        "lib/flags.ts",
        "lib/alert-rules.ts",
        "lib/comps.ts",
        "lib/nl-search.ts",
        "lib/saved-views.ts",
        "lib/deal-tasks.ts",
        "lib/ingest/persist.ts",
        "lib/ingest/resolve.ts",
        "lib/ingest/similarity.ts",
        "lib/signal-momentum.ts",
        "lib/corroboration.ts",
        "lib/win-loss.ts",
        "lib/report.ts",
        "lib/mentions.ts",
        "lib/process-stage.ts",
        "lib/deal-room.ts",
        "lib/contacts.ts",
        "lib/relationship-graph.ts",
        "lib/adapters/contacts.ts",
        "lib/bids.ts",
        "lib/pipeline.ts",
        "lib/ingest/hsr.ts",
        "lib/signal-timeline.ts",
        "lib/comps.ts",
        "lib/calendar.ts",
        "lib/calendar-token.ts",
        "lib/lp-report.ts",
        "lib/crm/map.ts",
      ],
      exclude: ["**/*.d.ts"],
      // Honest ratchet floor: the suite currently clears this; raise it as
      // coverage grows, never lower it.
      thresholds: {
        lines: 65,
        functions: 48,
        statements: 65,
        branches: 55,
      },
    },
  },
});
