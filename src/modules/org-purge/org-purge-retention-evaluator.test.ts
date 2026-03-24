import { describe, expect, it } from "vitest";
import { evaluateOrgPurgeRetention } from "./org-purge-retention-evaluator.service";

describe("evaluateOrgPurgeRetention", () => {
  it("blocks when legal hold is active", () => {
    const r = evaluateOrgPurgeRetention({ legalHoldActive: true });
    expect(r.blocked).toBe(true);
    if (r.blocked) {
      expect(r.reason).toBe("RETAIN_LEGAL_HOLD");
    }
  });

  it("allows when legal hold is false", () => {
    const r = evaluateOrgPurgeRetention({ legalHoldActive: false });
    expect(r.blocked).toBe(false);
    if (!r.blocked) {
      expect(r.exceptions.length).toBeGreaterThan(0);
    }
  });
});
