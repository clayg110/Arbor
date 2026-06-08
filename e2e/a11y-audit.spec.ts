import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Automated WCAG 2.0/2.1 A + AA audit across the app's key surfaces. Runs in mock
// mode (no auth), so every page renders from built-in data. A violation fails the
// build — keep this green. If a finding is a genuine false positive, exclude the
// specific rule with a documented reason rather than weakening the whole suite.
const PAGES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/radar",
  "/feed",
  "/analytics",
  "/review",
  "/watchlist",
  "/settings",
  "/admin",
  "/status",
  "/legal/privacy",
  "/legal/terms",
];

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

for (const path of PAGES) {
  test(`a11y: ${path} has no WCAG A/AA violations`, async ({ page }) => {
    await page.goto(path);
    // Let client islands hydrate so the audited DOM matches what users get, and
    // wait until the real app document is settled (lang + title applied by the
    // root layout) — otherwise a cold dev-compile can have axe scan a transient
    // blank document and report spurious document-title / html-has-lang.
    await page.waitForLoadState("networkidle");
    await page.waitForFunction(
      () => !!document.documentElement.lang && document.title.length > 0
    );

    const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();

    // On failure, surface each violation's rule id, impact, node count, and the
    // first offending selector + data (e.g. the failing contrast ratio) so the
    // fix is obvious from CI logs without rerunning locally.
    const summary = results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.length,
      example: v.nodes[0]?.target?.join(" "),
      data: v.nodes[0]?.any?.[0]?.data,
    }));
    expect(summary, JSON.stringify(summary, null, 2)).toEqual([]);
  });
}
