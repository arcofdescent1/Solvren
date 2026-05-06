import { describe, it, expect } from "vitest";
import {
  calculateActionabilityScore,
  calculateConfidenceInputScore,
  calculateUrgencyScore,
  canonicalPlaybookKey,
  deriveConfidenceBand,
  isPlaybookIssueType,
  isPayloadIncomplete,
} from "./issueIntelligenceScoring";

describe("deriveConfidenceBand", () => {
  it("uses 80/50 thresholds", () => {
    expect(deriveConfidenceBand(100)).toBe("high");
    expect(deriveConfidenceBand(80)).toBe("high");
    expect(deriveConfidenceBand(79)).toBe("medium");
    expect(deriveConfidenceBand(50)).toBe("medium");
    expect(deriveConfidenceBand(49)).toBe("low");
  });
});

describe("playbook types", () => {
  it("maps Value Engine keys to canonical names", () => {
    expect(canonicalPlaybookKey("stripe_failed_payments")).toBe("failed_payments");
    expect(canonicalPlaybookKey("hubspot_no_followup_leads")).toBe("no_follow_up");
    expect(isPlaybookIssueType("hubspot_stalled_deals")).toBe(true);
    expect(isPlaybookIssueType("stripe_retry_exhaustion")).toBe(false);
  });
});

describe("calculateConfidenceInputScore", () => {
  it("subtracts 15 on revenue impact fallback", () => {
    const withFb = calculateConfidenceInputScore({
      detectionConfidence: "high",
      detectionSource: "hubspot",
      affectedCount: 5,
      revenueImpactFallback: true,
    });
    const noFb = calculateConfidenceInputScore({
      detectionConfidence: "high",
      detectionSource: "hubspot",
      affectedCount: 5,
      revenueImpactFallback: false,
    });
    expect(withFb.score).toBe(noFb.score - 15);
  });
});

describe("calculateUrgencyScore", () => {
  it("first match: terminal status → 0", () => {
    const r = calculateUrgencyScore({
      status: "dismissed",
      approvalState: "not_required",
      slaDueAt: new Date(Date.now() - 1000).toISOString(),
      severity: "high",
      revenueImpactCents: 1_000_000,
    });
    expect(r.score).toBe(0);
  });

  it("SLA past due beats pending approval", () => {
    const r = calculateUrgencyScore({
      status: "detected",
      approvalState: "pending",
      slaDueAt: new Date(Date.now() - 1000).toISOString(),
      severity: "medium",
      revenueImpactCents: 0,
    });
    expect(r.score).toBe(100);
  });
});

describe("calculateActionabilityScore", () => {
  it("playbook-only → 60", () => {
    const r = calculateActionabilityScore({
      recommendedAction: null,
      ownerEmail: null,
      detectionType: "stripe_failed_payments",
    });
    expect(r.score).toBe(60);
  });

  it("recommended_action → 80", () => {
    const r = calculateActionabilityScore({
      recommendedAction: "Do X",
      ownerEmail: null,
      detectionType: "stripe_retry_exhaustion",
    });
    expect(r.score).toBe(80);
  });

  it("recommended + owner → 100", () => {
    const r = calculateActionabilityScore({
      recommendedAction: "Do X",
      ownerEmail: "a@b.com",
      detectionType: "stripe_failed_payments",
    });
    expect(r.score).toBe(100);
  });
});

describe("isPayloadIncomplete", () => {
  it("flags missing sample, empty sample, empty description, zero affected", () => {
    expect(
      isPayloadIncomplete({
        metadata: {},
        description: "x",
        affectedCount: 1,
      })
    ).toBe(true);
    expect(
      isPayloadIncomplete({
        metadata: { sampleRecords: [] },
        description: "x",
        affectedCount: 1,
      })
    ).toBe(true);
    expect(
      isPayloadIncomplete({
        metadata: { sampleRecords: [{}] },
        description: "",
        affectedCount: 1,
      })
    ).toBe(true);
    expect(
      isPayloadIncomplete({
        metadata: { sampleRecords: [{}] },
        description: "ok",
        affectedCount: 0,
      })
    ).toBe(true);
    expect(
      isPayloadIncomplete({
        metadata: { sampleRecords: [{}] },
        description: "ok",
        affectedCount: 2,
      })
    ).toBe(false);
  });
});
