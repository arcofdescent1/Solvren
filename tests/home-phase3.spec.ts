import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/auth";

test.describe("Phase 3 Home command center", () => {
  test("home renders canonical sections", async ({ page }) => {
    await loginAs(page, "owner");
    await page.goto("/home");
    await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "What Solvren is protecting right now" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Today's priorities" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Assigned to me" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Waiting on others" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Revenue at risk" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Where Solvren is protecting the business" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recent activity" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Go next" })).toBeVisible();
  });

  test("hero CTAs navigate to canonical destinations", async ({ page }) => {
    await loginAs(page, "owner");
    await page.goto("/home");
    await page.getByTestId("home-hero-action-center").click();
    await expect(page).toHaveURL(/\/actions(\?|$)/);
    await page.goto("/home");
    await page.getByTestId("home-hero-changes").click();
    await expect(page).toHaveURL(/\/changes\?view=all/);
  });

  test("go next cards navigate correctly", async ({ page }) => {
    await loginAs(page, "owner");
    await page.goto("/home");
    await page.getByTestId("home-go-next-issues").click();
    await expect(page).toHaveURL(/\/issues(\?|$)/);
  });
});
