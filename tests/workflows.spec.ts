/**
 * Tier 1 — Smoke: no seed required. Quick sanity checks.
 * Full workflow tests are in auth, change-intake, approval-flow, rbac, etc.
 */
import { expect, test } from "@playwright/test";

test.describe("Smoke (no seed required)", () => {
  test("health endpoint responds with status payload", async ({ request }) => {
    const res = await request.get("/api/health");
    const json = (await res.json()) as { status?: string; checks?: Record<string, unknown> };
    expect(["healthy", "degraded"]).toContain(json.status);
    expect(typeof json.checks).toBe("object");
  });

  test("admin jobs requires auth", async ({ page }) => {
    await page.goto("/admin/jobs");
    await expect(page).toHaveURL(/\/login/);
  });

  test("notifications retry API blocks unauthenticated access", async ({ request }) => {
    const res = await request.post("/api/notifications/retry", {
      data: { outboxId: "00000000-0000-0000-0000-000000000000" },
    });
    expect(res.status()).toBe(401);
  });
});
