/**
 * Tier 1 — Dashboard and search visibility.
 */
import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/auth";
import { CHANGE_TITLES } from "./fixtures/seed";

test.describe("Dashboard and search", () => {
  test("dashboard shows queue tiles for submitter", async ({ page }) => {
    await loginAs(page, "submitter");
    await page.goto("/dashboard");
    await expect(page.getByTestId("dashboard-tile-in-review")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("dashboard-tile-blocked")).toBeVisible();
  });

  test("search returns visible results for submitter", async ({ page }) => {
    await loginAs(page, "submitter");
    await page.goto("/search?q=Stripe");
    await expect(page.getByPlaceholder(/search changes/i)).toBeVisible({ timeout: 10_000 });
  });

  test("search page with Stripe query returns results", async ({ page }) => {
    await loginAs(page, "submitter");
    await page.goto("/search?q=Stripe");
    await expect(page.getByText(CHANGE_TITLES.PRICING_HIGH_RISK)).toBeVisible({ timeout: 15_000 });
  });
});
