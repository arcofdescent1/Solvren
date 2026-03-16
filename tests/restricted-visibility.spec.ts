/**
 * Tier 1 — Restricted visibility: Renee sees granted change, others do not.
 * Requires seeded restricted change and change_permissions. Run `npm run seed` first.
 */
import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/auth";
import { CHANGE_IDS, CHANGE_TITLES } from "./fixtures/seed";

test.describe("Restricted visibility", () => {
  test("restricted reviewer sees granted restricted change", async ({ page }) => {
    await loginAs(page, "restricted");
    await page.goto(`/changes/${CHANGE_IDS.RESTRICTED_SECURITY}`);
    await expect(page.locator("h1, [data-testid]").filter({ hasText: CHANGE_TITLES.RESTRICTED_SECURITY }).first()).toBeVisible({ timeout: 15_000 });
  });

  test("viewer cannot see restricted change (no permission)", async ({ page }) => {
    await loginAs(page, "viewer");
    await page.goto(`/changes/${CHANGE_IDS.RESTRICTED_SECURITY}`);
    await expect(page.getByText("You do not have permission to view this change.")).toBeVisible({ timeout: 15_000 });
  });

  test("owner can see restricted change", async ({ page }) => {
    await loginAs(page, "owner");
    await page.goto(`/changes/${CHANGE_IDS.RESTRICTED_SECURITY}`);
    await expect(page.getByRole("heading", { name: CHANGE_TITLES.RESTRICTED_SECURITY })).toBeVisible({ timeout: 15_000 });
  });
});
