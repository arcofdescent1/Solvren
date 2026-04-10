import { describe, it, expect } from "vitest";
import { getAttentionSummary } from "./attentionSummary";
import type { ExecutiveChangeView } from "./types";

function baseView(over: Partial<ExecutiveChangeView>): ExecutiveChangeView {
  return {
    id: "c1",
    title: "Pricing update",
    changeType: "Billing",
    status: "IN_REVIEW",
    riskLevel: "MEDIUM",
    recommendation: "PROCEED_WITH_CAUTION",
    confidenceScore: 70,
    confidenceLabel: "Moderate confidence",
    scheduledAt: null,
    revenueAtRisk: 50_000,
    revenueAtRiskPeriod: "MONTHLY",
    displayRevenueAtRisk: "$50K/month",
    customersAffected: null,
    customersAffectedDisplay: null,
    departmentsAffected: [],
    systemsAffected: [],
    readiness: [],
    signoffs: { approved: [], pending: [], rejected: [] },
    attentionSummary: [],
    hasApprovalConflict: false,
    approvalConflictMessage: null,
    executiveOverlay: "NONE",
    technicalDetails: { signals: [], policyViolations: [], incidents: [], notes: [] },
    slackPrimaryConcern: { primary: "", moreCount: 0 },
    revenueEscalationThresholdUsd: 100_000,
    hasRiskAssessment: true,
    ...over,
  };
}

describe("getAttentionSummary", () => {
  it("returns at most 3 bullets", () => {
    const lines = getAttentionSummary(
      baseView({
        readiness: [
          { category: "Support", status: "PENDING", owner: null, updatedAt: null },
          { category: "Finance", status: "PENDING", owner: null, updatedAt: null },
          { category: "Rollback Plan", status: "BLOCKED", owner: null, updatedAt: null },
        ],
        signoffs: { approved: ["Engineering"], pending: ["Finance"], rejected: [] },
      })
    );
    expect(lines.length).toBeLessThanOrEqual(3);
  });
});
