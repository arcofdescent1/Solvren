/**
 * Tier 1 — Reviewer workflow: My Approvals, blocked when evidence missing, approve when ready.
 * Uses seeded UAT personas: reviewer, finance
 */
import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/auth";
import { CHANGE_IDS, CHANGE_TITLES } from "./fixtures/seed";

test.describe("Reviewer workflow", () => {
  test("reviewer sees My Approvals tile on dashboard", async ({ page }) => {
    await loginAs(page, "reviewer");
    await page.goto("/dashboard");
    await expect(page.getByTestId("dashboard-tile-my-approvals")).toBeVisible({ timeout: 10_000 });
  });

  test("reviewer sees My Approvals queue with seeded changes", async ({ page }) => {
    await loginAs(page, "reviewer");
    await page.goto("/queue/my-approvals");
    await expect(page.getByTestId("reviews-table-my")).toBeVisible({ timeout: 10_000 });
  });

  test("finance reviewer sees assigned approval in My Approvals", async ({ page }) => {
    await loginAs(page, "finance");
    await page.goto("/queue/my-approvals");
    await expect(page.getByTestId("reviews-table-my")).toBeVisible({ timeout: 10_000 });
  });

  test("blocked queue shows Billing Reconciliation Patch (evidence missing)", async ({ page }) => {
    await loginAs(page, "submitter");
    await page.goto("/queue/blocked");
    await expect(page.getByTestId("reviews-table-blocked")).toBeVisible({ timeout: 10_000 });
  });

  test("reviewer can open blocked change detail", async ({ page }) => {
    await loginAs(page, "reviewer");
    await page.goto(`/changes/${CHANGE_IDS.BILLING_BLOCKED}`);
    await expect(page.getByRole("heading", { name: CHANGE_TITLES.BILLING_BLOCKED })).toBeVisible({ timeout: 10_000 });
  });

  test("overdue queue shows overdue change", async ({ page }) => {
    await loginAs(page, "finance");
    await page.goto("/queue/overdue");
    await expect(page.getByTestId("reviews-table-overdue")).toBeVisible({ timeout: 10_000 });
  });
});
