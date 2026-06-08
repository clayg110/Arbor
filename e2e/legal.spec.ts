import { test, expect } from "@playwright/test";

test("legal pages render and cross-link", async ({ page }) => {
  await page.goto("/legal/terms");
  await expect(page.getByRole("heading", { name: "Terms of Service" })).toBeVisible();

  await page.getByRole("link", { name: "Privacy", exact: true }).click();
  await expect(page).toHaveURL(/\/legal\/privacy/);
  await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
});

test("robots.txt is publicly served", async ({ request }) => {
  const res = await request.get("/robots.txt");
  expect(res.ok()).toBeTruthy();
  expect(await res.text()).toContain("Sitemap");
});
