import { describe, it, expect } from "vitest";
import { validateExecutiveApprove, validateExecutiveDecisionPayload } from "./executiveDecisionGuards";
import type { ExecutiveChangeView } from "./types";

function baseView(over: Partial<ExecutiveChangeView> = {}): ExecutiveChangeView {
  return {
    id: "c1",
    title: "T",
    changeType: "Billing",
    status: "IN_REVIEW",
    riskLevel: "LOW",
    recommendation: "PROCEED",
    confidenceScore: 80,
    confidenceLabel: "High confidence",
    scheduledAt: null,
    revenueAtRisk: null,
    revenueAtRiskPeriod: "MONTHLY",
    displayRevenueAtRisk: null,
    customersAffected: null,
    customersAffectedDisplay: null,
    departmentsAffected: ["Finance"],
    systemsAffected: ["Stripe"],
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

describe("validateExecutiveDecisionPayload", () => {
  it("requires comment for DELAY", () => {
    expect(validateExecutiveDecisionPayload("DELAY", "")).toBeTruthy();
    expect(validateExecutiveDecisionPayload("DELAY", "  ")).toBeTruthy();
    expect(validateExecutiveDecisionPayload("DELAY", "wait")).toBeNull();
  });
  it("allows empty comment for APPROVE", () => {
    expect(validateExecutiveDecisionPayload("APPROVE", "")).toBeNull();
  });
});

describe("validateExecutiveApprove", () => {
  it("blocks when readiness BLOCKED", () => {
    const v = baseView({
      readiness: [
        {
          category: "Finance",
          status: "BLOCKED",
          owner: null,
          updatedAt: null,
        },
      ],
    });
    const g = validateExecutiveApprove(v);
    expect(g).not.toBeNull();
    expect(g?.reasons.some((r) => r.includes("BLOCKED"))).toBe(true);
  });

  it("blocks when recommendation is ESCALATE", () => {
    const g = validateExecutiveApprove(baseView({ recommendation: "ESCALATE" }));
    expect(g?.reasons.some((r) => r.includes("ESCALATE"))).toBe(true);
  });
});
