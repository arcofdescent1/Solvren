/**
 * Tier 1 — Auth and protected-route behavior.
 * Uses seeded UAT personas. Run `npm run seed` before E2E.
 */
import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/auth";
import { PERSONAS } from "./fixtures/seed";

test.describe("Auth and protected routes", () => {
  test("home shows marketing page for unauthenticated user", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("banner").getByRole("link", { name: /sign in/i })).toBeVisible();
  });

  test("login page renders with form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByTestId("login-form")).toBeVisible();
    await expect(page.getByPlaceholder("Email")).toBeVisible();
    await expect(page.getByPlaceholder("Password")).toBeVisible();
  });

  test("dashboard requires auth", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("submitter can login and reach dashboard", async ({ page }) => {
    await loginAs(page, "submitter");
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/);
    await expect(page.getByRole("heading", { name: /revenue overview/i })).toBeVisible({ timeout: 10_000 });
  });

  test("viewer can login and reach dashboard", async ({ page }) => {
    await loginAs(page, "viewer");
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/);
  });

  test("reviewer can login and reach dashboard", async ({ page }) => {
    await loginAs(page, "reviewer");
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/);
  });

  test("owner can login and reach dashboard", async ({ page }) => {
    await loginAs(page, "owner");
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/);
  });

  test("invalid credentials show error", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("Email").fill(PERSONAS.submitter.email);
    await page.getByPlaceholder("Password").fill("wrong-password");
    await page.getByRole("button", { name: /^Login$/ }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/invalid|incorrect|error/i)).toBeVisible({ timeout: 5_000 });
  });

  test("forgot password page renders", async ({ page }) => {
    await page.goto("/auth/forgot-password");
    await expect(page.locator("form")).toBeVisible();
    await expect(page.getByPlaceholder("Email")).toBeVisible();
  });
});
