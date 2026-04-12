import { describe, expect, it } from "vitest";
import { phase4Thresholds } from "./phase4-thresholds";

describe("phase4Thresholds", () => {
  it("uses enterprise targets for BUSINESS", () => {
    const t = phase4Thresholds("BUSINESS");
    expect(t.businessUnitDelta).toBe(2);
    expect(t.connectedIntegrations).toBe(5);
    expect(t.consecutiveExecutiveWeeks).toBe(4);
  });

  it("uses reduced targets for SMB plans", () => {
    const t = phase4Thresholds("PRO");
    expect(t.businessUnitDelta).toBe(1);
    expect(t.connectedIntegrations).toBe(3);
    expect(t.consecutiveExecutiveWeeks).toBe(2);
  });
});
