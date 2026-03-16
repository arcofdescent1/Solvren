/**
 * Suite I-K: Dashboard and Compliance Reporting (V1 Test Plan)
 * TC-DASH-001/002/003, TC-REPORT-001/002
 */
import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/auth";

test.describe("Suite I - Dashboard", () => {
  test("TC-DASH-001: Dashboard loads", async ({ page }) => {
    await loginAs(page, "owner");
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /revenue overview/i })).toBeVisible({ timeout: 10000 });
  });

  test("TC-DASH-002: Dashboard tiles visible", async ({ page }) => {
    await loginAs(page, "owner");
    await page.goto("/dashboard");
    await expect(page.getByTestId("dashboard-tile-in-review")).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Suite K - Compliance Report", () => {
  test("TC-REPORT-001: Revenue governance report loads", async ({ page }) => {
    await loginAs(page, "owner");
    await page.goto("/reports/revenue-governance");
    await expect(
      page.getByRole("heading", { name: /revenue governance|compliance/i })
    ).toBeVisible({ timeout: 10000 });
  });
});
