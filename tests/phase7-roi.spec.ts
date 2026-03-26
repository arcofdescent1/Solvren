import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/auth";

test.describe("Phase 7 ROI value-proof", () => {
  test("insights shows compact impact and outcomes section", async ({ page }) => {
    await loginAs(page, "owner");
    await page.goto("/insights?range=30d");
    await expect(page.getByRole("heading", { name: "Impact and outcomes" })).toBeVisible();
    await expect(page.getByText("Potential issues prevented")).toBeVisible();
    await expect(page.getByRole("link", { name: /open full roi view/i })).toBeVisible();
  });

  test("insights roi page supports 7d/30d/90d range", async ({ page }) => {
    await loginAs(page, "owner");
    await page.goto("/insights/roi?range=30d");
    await page.getByRole("link", { name: "90d" }).click();
    await expect(page).toHaveURL(/\/insights\/roi\?range=90d/);
  });

  test("insights roi shows value storytelling cards with links", async ({ page }) => {
    await loginAs(page, "owner");
    await page.goto("/insights/roi?range=30d");
    await expect(page.getByText("Value storytelling")).toBeVisible();
    const maybeCard = page.locator("a[href*='source=roi']").first();
    const empty = page.getByText("Impact data is building");
    await expect(maybeCard.or(empty)).toBeVisible();
  });

  test("home shows lightweight impact signal", async ({ page }) => {
    await loginAs(page, "owner");
    await page.goto("/home");
    await expect(page.getByRole("heading", { name: "Impact signal" })).toBeVisible();
    await expect(page.getByRole("link", { name: /view impact and outcomes/i })).toBeVisible();
  });
});
