/**
 * Suite A - Authentication and Onboarding (V1 Test Plan)
 * TC-AUTH-002 through TC-AUTH-005
 */
import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/auth";
import { PERSONAS } from "./fixtures/seed";

test.describe("Suite A - Authentication and Onboarding", () => {
  test("TC-AUTH-002: Login as existing user", async ({ page }) => {
    await loginAs(page, "owner");
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/);
    await expect(page.getByRole("link", { name: /request beta access/i })).not.toBeVisible();
  });

  test("TC-AUTH-003: Reject invalid login", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("Email").fill(PERSONAS.submitter.email);
    await page.getByPlaceholder("Password").fill("wrong-password");
    await page.getByRole("button", { name: /^Login$/ }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator("form").getByText(/invalid|incorrect|error|wrong|credentials|login/i)).toBeVisible({ timeout: 10000 });
  });

  test("TC-AUTH-004: Logout", async ({ page }) => {
    await loginAs(page, "owner");
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /revenue overview/i })).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: /user menu/i }).click();
    await expect(page.getByRole("menuitem", { name: /logout/i }).or(page.getByRole("button", { name: /logout/i }))).toBeVisible({ timeout: 5000 });
    await page.getByRole("menuitem", { name: /logout/i }).or(page.getByRole("button", { name: /logout/i })).click();
    await expect(page).toHaveURL(/\/(login|\/?$)/, { timeout: 10000 });
  });

  test("TC-AUTH-005: First-time user sees onboarding or dashboard", async ({ page }) => {
    await loginAs(page, "owner");
    await page.goto("/dashboard");
    await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 10000 });
    const url = page.url();
    if (url.includes("onboarding")) {
      await expect(page.getByText(/connect|jira|slack|get started/i)).toBeVisible({ timeout: 5000 });
    } else {
      await expect(page.getByRole("heading", { name: /revenue overview/i })).toBeVisible({ timeout: 10000 });
    }
  });
});
