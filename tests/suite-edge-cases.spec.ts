/**
 * Edge Cases (V1 Test Plan)
 */
import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/auth";

test.describe("Edge Cases", () => {
  test("TC-EDGE-001: Integrations page loads", async ({ page }) => {
    await loginAs(page, "owner");
    await page.goto("/org/settings/integrations");
    await expect(page.getByRole("heading", { name: /integrations/i })).toBeVisible({ timeout: 10000 });
  });

  test("TC-EDGE-004: Risk audit page loads", async ({ page }) => {
    await loginAs(page, "owner");
    await page.goto("/risk/audit");
    await expect(page).toHaveURL(/\/risk\/audit/);
  });
});
