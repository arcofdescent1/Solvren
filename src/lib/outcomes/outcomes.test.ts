import { describe, expect, it } from "vitest";
import { computeRevenueProtected } from "@/lib/outcomes/revenueProtected";
import { confidenceMeetsRollupThreshold } from "@/lib/outcomes/types";
import { outcomeTypeFromPrediction } from "@/lib/outcomes/predictionOutcomeMap";
import { calendarQuarterBounds } from "@/lib/outcomes/reportPeriods";
import { trimmedMedianHours } from "@/lib/outcomes/approvalBaseline";
import { evaluateOutcomeThresholds } from "@/lib/outcomes/evaluateOutcomeThresholds";
import { isMajorOutageCorrectiveTimelineEvent } from "@/lib/outcomes/createMajorOutageAvoidedStory";

describe("computeRevenueProtected", () => {
  it("applies prevention confidence and duration factor", () => {
    const v = computeRevenueProtected({
      estimatedMrrAffected: 100_000,
      impactDurationMonths: 1,
      confidenceLevel: "LIKELY",
      outcomeType: "REVENUE_INCIDENT_AVOIDED",
    });
    expect(v).toBe(Math.round(100_000 * 0.5 * 1.0));
  });

  it("caps at 12x monthly MRR", () => {
    const v = computeRevenueProtected({
      estimatedMrrAffected: 10_000,
      impactDurationMonths: 12,
      confidenceLevel: "VERIFIED",
      outcomeType: "MAJOR_OUTAGE_AVOIDED",
    });
    const raw = 10_000 * 12 * 1.0 * 3.0;
    expect(raw).toBeGreaterThan(10_000 * 12);
    expect(v).toBe(10_000 * 12);
  });
});

describe("confidenceMeetsRollupThreshold", () => {
  it("orders thresholds", () => {
    expect(confidenceMeetsRollupThreshold("HIGH_CONFIDENCE", "HIGH_CONFIDENCE")).toBe(true);
    expect(confidenceMeetsRollupThreshold("LIKELY", "HIGH_CONFIDENCE")).toBe(false);
    expect(confidenceMeetsRollupThreshold("VERIFIED", "HIGH_CONFIDENCE")).toBe(true);
  });
});

describe("outcomeTypeFromPrediction", () => {
  it("maps approval risk", () => {
    expect(outcomeTypeFromPrediction("APPROVAL_SLA_RISK")).toBe("APPROVAL_DELAY_AVOIDED");
  });
  it("maps readiness deterioration", () => {
    expect(outcomeTypeFromPrediction("READINESS_DETERIORATING")).toBe("READINESS_IMPROVED");
  });
});

describe("calendarQuarterBounds", () => {
  it("returns Q2 for May", () => {
    const ref = new Date(Date.UTC(2026, 4, 10));
    const { start, end } = calendarQuarterBounds(ref);
    expect(start.toISOString().slice(0, 10)).toBe("2026-04-01");
    expect(end.getUTCMonth()).toBe(5);
  });
});

describe("trimmedMedianHours", () => {
  it("returns median of middle mass", () => {
    const hours = [1, 2, 3, 4, 100];
    expect(trimmedMedianHours(hours, 0.2)).toBe(3);
  });
});

describe("evaluateOutcomeThresholds", () => {
  const baseSlice = {
    incidents: 0,
    hours: 0,
    readiness: 0,
    periodStart: "2026-04-01",
    periodEnd: "2026-06-30",
  };

  it("emits milestone when a tier is newly crossed", () => {
    const ev = evaluateOutcomeThresholds({
      orgId: "00000000-0000-4000-8000-000000000001",
      mode: "QUARTER",
      current: { ...baseSlice, revenue: 60_000 },
      prior: { ...baseSlice, revenue: 40_000, periodStart: "2026-01-01", periodEnd: "2026-03-31" },
      milestoneUsd: [50_000, 100_000],
    });
    expect(ev.some((e) => e.thresholdType === "QUARTERLY_VALUE_MILESTONE")).toBe(true);
  });

  it("emits readiness improvement in month mode", () => {
    const ev = evaluateOutcomeThresholds({
      orgId: "00000000-0000-4000-8000-000000000001",
      mode: "MONTH",
      current: { ...baseSlice, revenue: 0, readiness: 22, periodStart: "2026-04-01", periodEnd: "2026-04-30" },
      prior: { ...baseSlice, revenue: 0, readiness: 10, periodStart: "2026-03-01", periodEnd: "2026-03-31" },
      milestoneUsd: [],
    });
    expect(ev.some((e) => e.thresholdType === "READINESS_IMPROVEMENT")).toBe(true);
  });
});

describe("isMajorOutageCorrectiveTimelineEvent", () => {
  it("accepts rollback plan signals", () => {
    expect(isMajorOutageCorrectiveTimelineEvent("ROLLBACK_PLAN_ADDED")).toBe(true);
  });
});
