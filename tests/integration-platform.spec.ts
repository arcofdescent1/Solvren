/**
 * Phase 2 — Integration platform conformance tests.
 * Validates shared platform behavior across providers.
 * Skip with: SKIP_INTEGRATION_TESTS=1 npx playwright test
 */
import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/auth";

const skipIntegration = process.env.SKIP_INTEGRATION_TESTS === "1";

(skipIntegration ? test.describe.skip : test.describe)("Integration platform conformance @integration", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "owner");
  });

  test("health API returns 400 for unknown provider", async ({ page }) => {
    const res = await page.request.get(
      "/api/integrations/unknown-provider/health?orgId=00000000-0000-0000-0000-000000000000"
    );
    expect(res.status()).toBe(400);
  });

  test("health API requires orgId", async ({ page }) => {
    const res = await page.request.get("/api/integrations/jira/health");
    expect(res.status()).toBe(400);
  });

  test("Jira integration page shows status and actions", async ({ page }) => {
    await page.goto("/org/settings/integrations/jira");
    await expect(page).toHaveURL(/\/org\/settings\/integrations\/jira/);
    await expect(
      page.getByRole("heading", { name: /jira integration/i })
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText("Not connected").or(page.getByText("Connected"))
    ).toBeVisible();
  });
});
