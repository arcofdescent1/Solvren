/**
 * Pass 7 — Search E2E tests.
 * Requires seeded UAT data. Run `npm run seed` before E2E.
 */
import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/auth";
import { CHANGE_TITLES } from "./fixtures/seed";

test.describe("Search", () => {
  test("search page loads with query input", async ({ page }) => {
    await loginAs(page, "submitter");
    await page.goto("/search");
    await expect(page.getByPlaceholder("Search by title, ID, system, domain…")).toBeVisible({ timeout: 10_000 });
  });

  test("Stripe query returns pricing change", async ({ page }) => {
    await loginAs(page, "submitter");
    await page.goto("/search?q=Stripe");
    await expect(page.getByText(CHANGE_TITLES.PRICING_HIGH_RISK)).toBeVisible({ timeout: 15_000 });
  });

  test("search returns grouped results", async ({ page }) => {
    await loginAs(page, "submitter");
    await page.goto("/search?q=Stripe");
    await expect(page.getByText("Searching…")).toBeVisible({ timeout: 5_000 }).catch(() => {});
    await expect(page.getByText("Searching…")).not.toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: /Changes \(\d+\)/ }).first()).toBeVisible({ timeout: 5_000 });
  });

  test("unauthorized viewer does not find restricted change in search", async ({ page }) => {
    await loginAs(page, "viewer");
    await page.goto("/search?q=Security");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(CHANGE_TITLES.RESTRICTED_SECURITY)).not.toBeVisible();
  });

  test("empty state when no results", async ({ page }) => {
    await loginAs(page, "submitter");
    await page.goto("/search?q=xyznonexistent123");
    await expect(page.getByText("Searching…")).toBeVisible({ timeout: 5_000 }).catch(() => {});
    await expect(page.getByText("Searching…")).not.toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Try searching by change title, system, domain, or evidence kind.")).toBeVisible({ timeout: 5_000 });
  });
});
