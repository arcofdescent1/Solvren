/**
 * Suite L-N: Integration Health and Audit Logging (V1 Test Plan)
 * TC-HEALTH-001, TC-AUDIT (API-level)
 */
import { expect, test } from "@playwright/test";

test.describe("Suite L - Integration Health", () => {
  test("TC-HEALTH: Health endpoint returns structured status", async ({ request }) => {
    const res = await request.get("/api/health");
    const json = (await res.json()) as { status?: string; checks?: Record<string, unknown> };
    expect(["healthy", "degraded"]).toContain(json.status);
    expect(typeof json.checks).toBe("object");
  });
});

test.describe("Suite N - Audit Logging", () => {
  test("TC-AUDIT-001: Audit API blocks unauthenticated access", async ({ request }) => {
    const res = await request.get("/api/audit/list?orgId=00000000-0000-0000-0000-000000000000");
    expect(res.status()).toBe(401);
  });
});
