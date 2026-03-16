/**
 * Suite B — Navigation and Shell Stability (V1 Test Plan)
 * TC-NAV-001 through TC-NAV-003
 */
import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/auth";

test.describe("Suite B — Navigation and Shell Stability", () => {
  test("TC-NAV-001: Authenticated root redirect", async ({ page }) => {
    await loginAs(page, "submitter");
    await page.goto("/");
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/);
    await expect(page.getByRole("link", { name: /request beta access/i })).not.toBeVisible();
  });

  test("TC-NAV-002: Public root for unauthenticated user", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("banner").getByRole("link", { name: /sign in/i })).toBeVisible();
  });

  test("TC-NAV-003: App shell consistency across routes", async ({ page }) => {
    await loginAs(page, "owner");
    const routes = ["/dashboard", "/changes", "/queue/my-approvals", "/org/settings/integrations"];
    for (const route of routes) {
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(route.replace(/\//g, "\\/") + "($|\\?)"), { timeout: 20_000 });
      await expect(page.getByRole("banner").getByRole("link", { name: /sign in/i })).not.toBeVisible();
    }
  });
});
