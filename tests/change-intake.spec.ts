/**
 * Tier 1 — Submitter workflow: create draft, guided intake, submit for review.
 * Uses seeded UAT persona: submitter@uat.solvren.test
 */
import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/auth";
import { CHANGE_IDS, CHANGE_TITLES } from "./fixtures/seed";

test.describe("Submitter workflow", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "submitter");
  });

  test("submitter can create draft and start guided intake", async ({ page }) => {
    await page.goto("/changes/new");
    await expect(page.getByTestId("start-guided-intake")).toBeVisible();
    await page.getByPlaceholder(/annual plan|title/i).fill("E2E Test Change");
    await page.getByTestId("start-guided-intake").click();
    await page.waitForURL(/\/changes\/[^/]+\/intake/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/intake\?step=/);
  });

  test("submitter sees seeded draft and can open intake", async ({ page }) => {
    await page.goto(`/changes/${CHANGE_IDS.DRAFT_IN_PROGRESS}`);
    await expect(page.getByRole("heading", { name: "Chargebee Plan Migration Draft" })).toBeVisible({ timeout: 10_000 });
  });

  test("submitter sees seeded ready change with submit button", async ({ page }) => {
    await page.goto(`/changes/${CHANGE_IDS.LEAD_ROUTING}`);
    await expect(page.getByRole("heading", { name: CHANGE_TITLES.LEAD_ROUTING })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("submit-for-review")).toBeVisible();
  });

  test("submitter sees in-review change without submit option", async ({ page }) => {
    await page.goto(`/changes/${CHANGE_IDS.PRICING_HIGH_RISK}`);
    await expect(page.getByRole("heading", { name: CHANGE_TITLES.PRICING_HIGH_RISK })).toBeVisible({ timeout: 10_000 });
  });
});
