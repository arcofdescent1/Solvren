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
    executiveBlocked: false,
    executiveSnoozeUntil: null,
    technicalDetails: { signals: [], policyViolations: [], incidents: [], notes: [] },
    slackPrimaryConcern: { primary: "", moreCount: 0 },
    revenueEscalationThresholdUsd: 100_000,
    hasRiskAssessment: true,
    ...over,
  };
}

describe("validateExecutiveDecisionPayload", () => {
  it("allows empty comment for DELAY", () => {
    expect(validateExecutiveDecisionPayload("DELAY", "")).toBeNull();
    expect(validateExecutiveDecisionPayload("DELAY", "wait")).toBeNull();
  });
  it("allows empty comment for APPROVE", () => {
    expect(validateExecutiveDecisionPayload("APPROVE", "")).toBeNull();
  });
  it("requires comment for DENY and REQUEST_INFO", () => {
    expect(validateExecutiveDecisionPayload("DENY", "")).toBeTruthy();
    expect(validateExecutiveDecisionPayload("DENY", "no")).toBeNull();
    expect(validateExecutiveDecisionPayload("REQUEST_INFO", "")).toBeTruthy();
  });
});

describe("validateExecutiveApprove", () => {
  it("does not block on readiness or recommendation (overlay is directional)", () => {
    const v = baseView({
      readiness: [
        {
          category: "Finance",
          status: "BLOCKED",
          owner: null,
          updatedAt: null,
        },
      ],
      recommendation: "ESCALATE",
    });
    expect(validateExecutiveApprove(v)).toBeNull();
  });
});
