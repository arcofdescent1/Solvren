import { describe, it, expect } from "vitest";
import { buildExecutiveDmSlackBlocks } from "./executiveDmBlocks";
import type { ExecutiveChangeView } from "@/lib/executive/types";

const mockView = (): ExecutiveChangeView => ({
  id: "abc",
  title: "Pricing Rules Update",
  changeType: "Pricing",
  status: "IN_REVIEW",
  riskLevel: "MEDIUM",
  recommendation: "PROCEED_WITH_CAUTION",
  confidenceScore: 78,
  confidenceLabel: "Moderate confidence",
  scheduledAt: null,
  revenueAtRisk: 120_000,
  revenueAtRiskPeriod: "MONTHLY",
  displayRevenueAtRisk: "$120K/month",
  customersAffected: 2400,
  customersAffectedDisplay: "~2.4K",
  departmentsAffected: ["Sales"],
  systemsAffected: ["Checkout"],
  readiness: [
    { category: "Support", status: "PENDING", owner: null, updatedAt: null },
  ],
  signoffs: { approved: [], pending: ["Support"], rejected: [] },
  attentionSummary: [],
  hasApprovalConflict: false,
  approvalConflictMessage: null,
  executiveOverlay: "NONE",
  executiveBlocked: false,
  executiveSnoozeUntil: null,
  technicalDetails: { signals: [], policyViolations: [], incidents: [], notes: [] },
  slackPrimaryConcern: { primary: "Support still pending", moreCount: 0 },
  revenueEscalationThresholdUsd: 100_000,
  hasRiskAssessment: true,
});

describe("buildExecutiveDmSlackBlocks", () => {
  it("includes overview URL and executive overlay action ids", () => {
    const blocks = buildExecutiveDmSlackBlocks({
      view: mockView(),
      overviewUrl: "https://example.com/executive/changes/abc",
      orgId: "o1",
    });
    const actionBlocks = blocks.filter((b) => b.type === "actions") as Array<{
      elements?: Array<{ action_id?: string; url?: string }>;
    }>;
    const elements = actionBlocks.flatMap((b) => b.elements ?? []);
    expect(elements.some((e) => e.action_id === "executive_overlay_approve")).toBe(true);
    expect(elements.some((e) => e.action_id === "executive_overlay_deny")).toBe(true);
    expect(elements.some((e) => e.url?.includes("/executive/changes/abc"))).toBe(true);
  });
});
