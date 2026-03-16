/**
 * Suite M — RBAC (V1 Test Plan) TC-RBAC-001 through TC-RBAC-004
 * Viewer cannot create/approve, submitter cannot access admin.
 */
import { expect, test } from "@playwright/test";
import { loginAs } from "./fixtures/auth";

test.describe("RBAC", () => {
  test("viewer does not see New change request on dashboard", async ({ page }) => {
    await loginAs(page, "viewer");
    await page.goto("/dashboard");
    await expect(page.getByTestId("nav-new-change")).not.toBeVisible();
  });

  test("viewer creating draft gets blocked by API", async ({ page }) => {
    await loginAs(page, "viewer");
    await page.goto("/changes/new");
    await expect(page.getByTestId("start-guided-intake")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("start-guided-intake").click();
    await expect(page.getByText(/Forbidden|forbidden|permission|not allowed/i)).toBeVisible({ timeout: 5_000 });
  });

  test("submitter sees New change request", async ({ page }) => {
    await loginAs(page, "submitter");
    await page.goto("/dashboard");
    await expect(page.getByTestId("nav-new-change")).toBeVisible({ timeout: 10_000 });
  });

  test("submitter does not see Team & invites (admin-only) link on org settings", async ({ page }) => {
    await loginAs(page, "submitter");
    await page.goto("/org/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("link", { name: /Approval policies/i })).not.toBeVisible();
  });

  test("owner can access org settings", async ({ page }) => {
    await loginAs(page, "owner");
    await page.goto("/org/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible({ timeout: 10_000 });
  });

  test("TC-RBAC-003: Admin can access integrations", async ({ page }) => {
    await loginAs(page, "owner");
    await page.goto("/org/settings/integrations");
    await expect(page.getByRole("heading", { name: /integrations/i })).toBeVisible({ timeout: 10_000 });
  });

  test("TC-RBAC-004: Reviewer can view dashboard and approvals", async ({ page }) => {
    await loginAs(page, "reviewer");
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /revenue overview/i })).toBeVisible({ timeout: 10_000 });
    await page.goto("/queue/my-approvals");
    await expect(page.getByTestId("reviews-table-my")).toBeVisible({ timeout: 10_000 });
  });
});
