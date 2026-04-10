/**
 * Suite E-F: Change Request Creation and Approval Workflow (V1 Test Plan)
 */
import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/auth";
import { CHANGE_IDS, CHANGE_TITLES } from "./fixtures/seed";

test.describe("Suite E - Change Request Creation", () => {
  test("TC-CHANGE-001: Create draft change request", async ({ page }) => {
    await loginAs(page, "submitter");
    await page.goto("/intake/new");
    await expect(page.getByTestId("start-guided-intake")).toBeVisible();
    await page.getByPlaceholder(/annual plan|e\.g\./i).fill("E2E Pricing Change Test");
    await page.getByTestId("start-guided-intake").click();
    await page.waitForURL(/\/changes\/[^/]+\/intake/, { timeout: 15000 });
  });

  test("TC-CHANGE-004: Ready change shows submit button", async ({ page }) => {
    await loginAs(page, "submitter");
    const leadRoutingId = CHANGE_IDS.LEAD_ROUTING;
    await page.goto("/changes/" + leadRoutingId);
    await expect(page.getByRole("heading", { name: CHANGE_TITLES.LEAD_ROUTING })).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("submit-for-review")).toBeVisible();
  });

  test("TC-CHANGE-005: Blocked change visible", async ({ page }) => {
    await loginAs(page, "submitter");
    await page.goto("/changes/" + CHANGE_IDS.BILLING_BLOCKED);
    await expect(page.getByRole("heading", { name: CHANGE_TITLES.BILLING_BLOCKED })).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Suite F - Approval Workflow", () => {
  test("TC-APP-001: Reviewer sees My Approvals", async ({ page }) => {
    await loginAs(page, "reviewer");
    await page.goto("/queue/my-approvals");
    await expect(page.getByTestId("reviews-table-my")).toBeVisible({ timeout: 10000 });
  });

  test("TC-APP-002: Reviewer can open change", async ({ page }) => {
    await loginAs(page, "reviewer");
    await page.goto("/changes/" + CHANGE_IDS.PRICING_HIGH_RISK);
    await expect(page.getByRole("heading", { name: CHANGE_TITLES.PRICING_HIGH_RISK })).toBeVisible({ timeout: 10000 });
  });

  test("TC-APP-004: Overdue queue visible", async ({ page }) => {
    await loginAs(page, "finance");
    await page.goto("/queue/overdue");
    await expect(page.getByTestId("reviews-table-overdue")).toBeVisible({ timeout: 10000 });
  });
});
