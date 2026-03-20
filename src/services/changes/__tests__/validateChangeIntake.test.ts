import { describe, expect, test } from "vitest";
import { validateChangeIntake } from "../validateChangeIntake";

describe("validateChangeIntake", () => {
  test("rejects null change", () => {
    const res = validateChangeIntake(null);
    expect(res.ok).toBe(false);
  });

  test("requires core intake fields", () => {
    const res = validateChangeIntake({
      domain: "REVENUE",
      systems_involved: [],
      rollout_method: null,
      backfill_required: null,
      customer_impact_expected: null,
      planned_release_at: null,
    } as Record<string, unknown>);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.join(" ")).toContain("systems_involved");
      expect(res.errors.join(" ")).toContain("rollout_method");
    }
  });

  test("passes for a minimal valid REVENUE change", () => {
    const res = validateChangeIntake({
      domain: "REVENUE",
      change_type: "CONFIG",
      systems_involved: ["billing"],
      rollout_method: "gradual",
      backfill_required: false,
      customer_impact_expected: false,
      planned_release_at: new Date().toISOString(),
      revenue_surface: "checkout",
      estimated_mrr_affected: 0,
      percent_customer_base_affected: 0,
    } as Record<string, unknown>);

    expect(res.ok).toBe(true);
  });
});
