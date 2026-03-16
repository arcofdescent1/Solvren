/**
 * Tier 2 — Notifications: in-app notification visibility.
 * Requires seeded data.
 */
import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/auth";

test.describe("Notifications", () => {
  test("logged-in user can open notifications page", async ({ page }) => {
    await loginAs(page, "submitter");
    await page.goto("/notifications");
    await expect(page.getByRole("heading", { name: /notification/i })).toBeVisible({ timeout: 10_000 });
  });
});
