import { defineConfig, devices } from "@playwright/test";

// E2E runs the app in MOCK MODE: the webServer below starts `next dev` with the
// Supabase env vars blanked, so middleware skips auth and every page renders
// from the built-in mock data — deterministic, no login, no backend.
const PORT = 3210;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // The dev server compiles each route on first hit, so the first navigation to
  // a cold route can be slow under load. Retry once locally to absorb a cold-compile
  // miss, and cap workers so parallel specs don't trigger a thundering herd of
  // simultaneous compiles that starve each other's CPU.
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : 4,
  // Per-test cap; cold compiles of heavy routes (analytics/Recharts) eat into this.
  timeout: 90_000,
  // Navigation/visibility waits must outlast a cold route compile.
  expect: { timeout: 30_000 },
  // Always emit the HTML report (CI uploads it as an artifact); `list` keeps the
  // console/CI logs readable alongside it.
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    // Emulate prefers-reduced-motion so entrance/shimmer animations resolve to
    // their final state instantly — keeps element-visibility waits deterministic
    // and matches what motion-averse users see.
    contextOptions: { reducedMotion: "reduce" },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm exec next dev -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // Blank Supabase env → @next/env won't override these already-present keys
    // from .env.local, so hasSupabaseEnv() is false and the app stays in mock mode.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
    },
  },
});
