import { test, expect } from "@playwright/test";

test("settings exposes data export + account deletion", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Account & privacy" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download my data" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete my account" })).toBeVisible();
});

test("delete dialog opens and closes on Escape (focus-trap)", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "Delete my account" }).click();

  const dialog = page.getByRole("dialog", { name: "Confirm account deletion" });
  await expect(dialog).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});
