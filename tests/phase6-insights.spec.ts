import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/auth";

test.describe("Phase 6 Insights narrative", () => {
  test("insights landing shows narrative sections", async ({ page }) => {
    await loginAs(page, "owner");
    await page.goto("/insights?range=7d");
    await expect(page.getByRole("heading", { name: "Current exposure" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Exposure trend" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Top risk drivers" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "What is being done" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Coverage and gaps" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Impact over time" })).toBeVisible();
  });

  test("insights range toggle persists in URL", async ({ page }) => {
    await loginAs(page, "owner");
    await page.goto("/insights?range=7d");
    await page.getByRole("link", { name: "30d" }).click();
    await expect(page).toHaveURL(/\/insights\?range=30d/);
  });

  test("risk drivers routes directly to operations", async ({ page }) => {
    await loginAs(page, "owner");
    await page.goto("/insights/risk-drivers");
    const opLink = page.getByRole("link", { name: /open high-impact changes/i }).first();
    await expect(opLink).toBeVisible();
  });
});
