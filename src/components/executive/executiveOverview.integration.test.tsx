/**
 * Lightweight UI checks (server render) — runs with default vitest unit project.
 */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HeroSummaryCard } from "./HeroSummaryCard";
import { ApprovalConflictBanner } from "./ApprovalConflictBanner";
import { TechnicalDetailsDrawer } from "./TechnicalDetailsDrawer";
import type { ExecutiveChangeView } from "@/lib/executive/types";

function mockView(): ExecutiveChangeView {
  return {
    id: "x",
    title: "Test Change",
    changeType: "Billing",
    status: "IN_REVIEW",
    riskLevel: "MEDIUM",
    recommendation: "PROCEED_WITH_CAUTION",
    confidenceScore: 78,
    confidenceLabel: "Moderate confidence",
    scheduledAt: null,
    revenueAtRisk: 120_000,
    revenueAtRiskPeriod: "MONTHLY",
    displayRevenueAtRisk: "$120K/month",
    customersAffected: 100,
    customersAffectedDisplay: "100",
    departmentsAffected: ["Finance"],
    systemsAffected: ["Billing"],
    readiness: [],
    signoffs: { approved: [], pending: [], rejected: [] },
    attentionSummary: [],
    hasApprovalConflict: true,
    approvalConflictMessage: "Finance rejected while Engineering approved.",
    executiveOverlay: "NONE",
    technicalDetails: {
      signals: [{ key: "failed_payment_spike" }],
      policyViolations: [],
      incidents: [],
      notes: [],
    },
    slackPrimaryConcern: { primary: "Conflict", moreCount: 1 },
    revenueEscalationThresholdUsd: 100_000,
    hasRiskAssessment: true,
  };
}

describe("Executive overview UI (integration-style)", () => {
  it("renders hero summary", () => {
    const html = renderToStaticMarkup(<HeroSummaryCard view={mockView()} />);
    expect(html).toContain("Test Change");
    expect(html).toContain("Proceed With Caution");
  });

  it("shows approval conflict banner when expected", () => {
    const html = renderToStaticMarkup(
      <ApprovalConflictBanner message="Finance rejected while Engineering approved." />
    );
    expect(html).toContain("approval-conflict-banner");
    expect(html).toContain("Finance rejected");
  });

  it("keeps technical details collapsed by default", () => {
    const html = renderToStaticMarkup(<TechnicalDetailsDrawer view={mockView()} />);
    expect(html).toContain("Show technical details");
    expect(html).toContain("technical-details-collapsed");
    expect(html).not.toContain("failed_payment_spike");
  });
});
