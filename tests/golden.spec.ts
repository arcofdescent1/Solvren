import { test, expect } from "@playwright/test";

test.describe("Golden UI Snapshots", () => {
  test.skip(
    process.env.PLAYWRIGHT_VISUAL !== "1",
    "Visual snapshots are opt-in (set PLAYWRIGHT_VISUAL=1)."
  );

  test("Login Page Light", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveScreenshot("login-light.png");
  });

  test("Login Page Dark", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("rg.theme", "dark");
    });
    await page.goto("/login");
    await page.reload();
    await expect(page).toHaveScreenshot("login-dark.png");
  });

  test("Home shows marketing landing page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/");
    await expect(page).toHaveScreenshot("home-landing.png");
  });
});
