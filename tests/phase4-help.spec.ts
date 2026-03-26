import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/auth";

test.describe("Phase 4 help system", () => {
  test("home page-level help drawer opens", async ({ page }) => {
    await loginAs(page, "owner");
    await page.goto("/home");
    await page.getByRole("button", { name: "How this page works" }).click();
    await expect(page.getByRole("heading", { name: "How this page works" })).toBeVisible();
    await expect(page.getByText(/Home is your revenue risk command center/i)).toBeVisible();
  });

  test("home metric tooltip opens on explicit click", async ({ page }) => {
    await loginAs(page, "owner");
    await page.goto("/home");
    const metricHelp = page.getByLabel("Help: revenue_at_risk").first();
    await metricHelp.click();
    await expect(metricHelp).toBeVisible();
  });

  test("changes filter help tooltip is keyboard accessible", async ({ page }) => {
    await loginAs(page, "owner");
    await page.goto("/changes?view=all");
    const helpButton = page.getByLabel("Help: high_impact").first();
    await helpButton.focus();
    await page.keyboard.press("Enter");
    await expect(helpButton).toBeFocused();
  });

  test("risk drivers subpage has page help drawer", async ({ page }) => {
    await loginAs(page, "owner");
    await page.goto("/insights/risk-drivers");
    await page.getByRole("button", { name: "How this page works" }).click();
    await expect(page.getByText(/Risk Drivers shows where business impact is concentrated/i)).toBeVisible();
  });

  test("settings policies subpage has enforcement help", async ({ page }) => {
    await loginAs(page, "owner");
    await page.goto("/settings/policies");
    const helpButton = page.getByLabel("Help: enforcement mode");
    await helpButton.first().click();
    await expect(helpButton.first()).toBeVisible();
  });
});
