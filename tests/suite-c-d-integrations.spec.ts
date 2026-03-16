/**
 * Suite C-D: Jira and Slack Integration Setup (V1 Test Plan)
 * Skip with SKIP_INTEGRATION_TESTS=1
 */
import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/auth";

const skipIntegration = process.env.SKIP_INTEGRATION_TESTS === "1";

(skipIntegration ? test.describe.skip : test.describe)("Suite C-D - Integration Setup", () => {
  test("TC-JIRA-001: Jira integration page loads", async ({ page }) => {
    await loginAs(page, "owner");
    await page.goto("/org/settings/integrations/jira");
    await expect(page.getByRole("heading", { name: /jira/i })).toBeVisible({ timeout: 10000 });
  });

  test("TC-SLACK-001: Slack integration page loads", async ({ page }) => {
    await loginAs(page, "owner");
    await page.goto("/org/settings/integrations/slack");
    await expect(page.getByRole("heading", { name: /slack/i })).toBeVisible({ timeout: 10000 });
  });
});
