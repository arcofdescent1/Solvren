/**
 * Phase 1 — Shell ownership and navigation stability.
 * Ensures public and app shells render correctly and never collide.
 */
import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/auth";

test.describe("Shell ownership", () => {
  test("unauthenticated visit to / sees public header, no app side nav", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("banner").getByRole("link", { name: /sign in/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /request beta access/i }).first()).toBeVisible();
    // App shell nav links to /dashboard; public page has no direct dashboard link
    await expect(page.locator('a[href="/dashboard"]')).not.toBeVisible();
  });

  test("authenticated visit to / redirects to /dashboard", async ({
    page,
  }) => {
    await loginAs(page, "submitter");
    await page.goto("/");
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/);
  });

  test("authenticated visit to /dashboard sees app shell, no public header", async ({
    page,
  }) => {
    await loginAs(page, "submitter");
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/);
    await expect(page.getByRole("heading", { name: /revenue overview/i })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole("link", { name: /request beta access/i })).not.toBeVisible();
  });

  test("authenticated visit to org settings sees app shell", async ({
    page,
  }) => {
    await loginAs(page, "owner");
    await page.goto("/org/settings/integrations/jira");
    await expect(page).toHaveURL(/\/org\/settings\/integrations\/jira/);
    await expect(page.getByRole("heading", { name: /jira|integrations/i })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole("link", { name: /request beta access/i })).not.toBeVisible();
  });

  test("dashboard requires auth", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("login from public route redirects into app shell", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("banner").getByRole("link", { name: /sign in/i })).toBeVisible();
    await loginAs(page, "submitter");
    await expect(page.getByRole("heading", { name: /revenue overview/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("link", { name: /request beta access/i })).not.toBeVisible();
  });
});
