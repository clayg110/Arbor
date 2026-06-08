import { test, expect } from "@playwright/test";

test("the first Tab reaches the skip link", async ({ page }) => {
  await page.goto("/radar");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
});

test("cookie notice shows then dismisses", async ({ page }) => {
  await page.goto("/radar");
  const notice = page.getByRole("region", { name: "Cookie notice" });
  await expect(notice).toBeVisible();
  await page.getByRole("button", { name: "Got it" }).click();
  await expect(notice).toHaveCount(0);
});
