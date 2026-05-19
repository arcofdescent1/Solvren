import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/auth";

test.describe("canonical app routes", () => {
  test("routes work and aliases land on canonical surfaces", async ({ page }) => {
    await loginAs(page, "owner");

    await page.goto("/action-queue");
    await expect(page).toHaveURL(/\/actions/);
    await expect(page.getByRole("heading", { name: "Work Queue" })).toBeVisible({ timeout: 10_000 });

    await page.goto("/roi");
    await expect(page).toHaveURL(/\/insights\/roi/);
    await expect(page.getByRole("heading", { name: "Impact and outcomes" })).toBeVisible({ timeout: 10_000 });

    await page.goto("/settings");
    await page.locator('a[href="/settings/security"]').click();
    await expect(page.getByRole("heading", { name: /Security & data protection/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("link", { name: "Permission matrix" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Audit coverage" })).toBeVisible();
  });
});
