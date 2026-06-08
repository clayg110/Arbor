import { test, expect } from "@playwright/test";

// Runs in mock mode (see playwright.config webServer env) — no auth, mock data.

test("home redirects to the radar board", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/radar/);
  await expect(page.getByRole("heading", { name: "In market" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Monitor for exit" })).toBeVisible();
});

test("navigates the main sections", async ({ page }) => {
  await page.goto("/radar");

  await page.getByRole("link", { name: "Feed", exact: true }).click();
  await expect(page).toHaveURL(/\/feed/);
  await expect(page.getByRole("heading", { name: "Activity feed" })).toBeVisible();

  await page.getByRole("link", { name: "Analytics", exact: true }).click();
  await expect(page).toHaveURL(/\/analytics/);
  await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();

  await page.getByRole("link", { name: "Watchlist", exact: true }).click();
  await expect(page).toHaveURL(/\/watchlist/);
});

test("radar renders mock companies and accepts a search query", async ({ page }) => {
  await page.goto("/radar");
  const search = page.getByPlaceholder("Search company, sponsor, sector…");
  await expect(search).toBeVisible();
  await search.fill("nomatch-zzzz");
  // Typing must not crash the board — the columns stay rendered.
  await expect(page.getByRole("heading", { name: "In market" })).toBeVisible();
});
