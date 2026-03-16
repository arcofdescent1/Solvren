/**
 * Tier 1 — API auth: unauthenticated requests are blocked.
 */
import { expect, test } from "@playwright/test";

test.describe("API auth", () => {
  test("health endpoint responds", async ({ request }) => {
    const res = await request.get("/api/health");
    const json = (await res.json()) as { status?: string; checks?: Record<string, unknown> };
    expect(["healthy", "degraded"]).toContain(json.status);
  });

  test("draft creation API blocks unauthenticated access", async ({ request }) => {
    const res = await request.post("/api/changes/draft", {
      data: { orgId: "00000000-0000-0000-0000-000000000000", title: "x" },
    });
    expect(res.status()).toBe(401);
  });

  test("approval decide API blocks unauthenticated access", async ({ request }) => {
    const res = await request.post("/api/approvals/decide", {
      data: { approvalId: "00000000-0000-0000-0000-000000000000", decision: "APPROVED" },
    });
    expect(res.status()).toBe(401);
  });

  test("search API blocks unauthenticated access", async ({ request }) => {
    const res = await request.get("/api/search?q=pricing");
    expect(res.status()).toBe(401);
  });
});
