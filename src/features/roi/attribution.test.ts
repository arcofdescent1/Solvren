import { describe, expect, it } from "vitest";
import { computeImpactBoundary, confidenceRank, qualifiesLikelyPrevented } from "./attribution";

describe("roi attribution helpers", () => {
  it("computes earliest impact boundary", () => {
    const boundary = computeImpactBoundary({
      completionTimeMs: 2000,
      incidentTimeMs: 1500,
    });
    expect(boundary).toBe(1500);
  });

  it("qualifies likely prevented only when intervention precedes impact and 14d passes", () => {
    const day = 24 * 60 * 60 * 1000;
    const ok = qualifiesLikelyPrevented({
      interventionTimeMs: 1000,
      impactBoundaryTimeMs: 9000,
      incidentTimeMs: null,
      nowMs: 1000 + 14 * day,
    });
    const bad = qualifiesLikelyPrevented({
      interventionTimeMs: 1000,
      impactBoundaryTimeMs: 900,
      incidentTimeMs: null,
      nowMs: 1000 + 20 * day,
    });
    expect(ok).toBe(true);
    expect(bad).toBe(false);
  });

  it("ranks confidence levels highest to lowest", () => {
    expect(confidenceRank("confirmed_resolved")).toBeGreaterThan(confidenceRank("likely_prevented"));
    expect(confidenceRank("likely_prevented")).toBeGreaterThan(confidenceRank("observed"));
    expect(confidenceRank("observed")).toBeGreaterThan(confidenceRank("estimated"));
  });
});
