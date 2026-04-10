import { describe, it, expect } from "vitest";
import { getExecutiveRecommendation } from "./recommendation";
import type { ReadinessRow } from "./types";

const baseRows: ReadinessRow[] = [
  { category: "Engineering", status: "READY", owner: null, updatedAt: null },
  { category: "QA", status: "READY", owner: null, updatedAt: null },
  { category: "Support", status: "READY", owner: null, updatedAt: null },
  { category: "Sales", status: "READY", owner: null, updatedAt: null },
  { category: "Finance", status: "READY", owner: null, updatedAt: null },
  { category: "Rollback Plan", status: "READY", owner: null, updatedAt: null },
  { category: "Monitoring / Alerting", status: "READY", owner: null, updatedAt: null },
];

describe("getExecutiveRecommendation", () => {
  it("Case 5 — all ready, low risk → PROCEED", () => {
    const r = getExecutiveRecommendation({
      riskLevel: "LOW",
      readiness: baseRows,
      hasApprovalConflict: false,
      revenueAtRiskMonthly: 10_000,
      revenueThresholdUsd: 100_000,
      hasBlockedReadiness: false,
      hasCriticalPendingReadiness: false,
      hasOpenIncidents: false,
      hasCoordinationErrors: false,
    });
    expect(r).toBe("PROCEED");
  });

  it("Case 1 — medium risk, support pending → PROCEED_WITH_CAUTION", () => {
    const rows = baseRows.map((x) =>
      x.category === "Support" ? { ...x, status: "PENDING" as const } : x
    );
    const r = getExecutiveRecommendation({
      riskLevel: "MEDIUM",
      readiness: rows,
      hasApprovalConflict: false,
      revenueAtRiskMonthly: 20_000,
      revenueThresholdUsd: 100_000,
      hasBlockedReadiness: false,
      hasCriticalPendingReadiness: true,
      hasOpenIncidents: false,
      hasCoordinationErrors: false,
    });
    expect(r).toBe("PROCEED_WITH_CAUTION");
  });

  it("Case 2 — rollback blocked → DELAY", () => {
    const rows = baseRows.map((x) =>
      x.category === "Rollback Plan" ? { ...x, status: "BLOCKED" as const } : x
    );
    const r = getExecutiveRecommendation({
      riskLevel: "MEDIUM",
      readiness: rows,
      hasApprovalConflict: false,
      revenueAtRiskMonthly: 10_000,
      revenueThresholdUsd: 100_000,
      hasBlockedReadiness: true,
      hasCriticalPendingReadiness: false,
      hasOpenIncidents: false,
      hasCoordinationErrors: false,
    });
    expect(r).toBe("DELAY");
  });

  it("Case 3 — conflicting signoffs → ESCALATE", () => {
    const r = getExecutiveRecommendation({
      riskLevel: "LOW",
      readiness: baseRows,
      hasApprovalConflict: true,
      revenueAtRiskMonthly: 1_000,
      revenueThresholdUsd: 100_000,
      hasBlockedReadiness: false,
      hasCriticalPendingReadiness: false,
      hasOpenIncidents: false,
      hasCoordinationErrors: false,
    });
    expect(r).toBe("ESCALATE");
  });

  it("Case 4 — high revenue exposure → ESCALATE", () => {
    const r = getExecutiveRecommendation({
      riskLevel: "MEDIUM",
      readiness: baseRows,
      hasApprovalConflict: false,
      revenueAtRiskMonthly: 150_000,
      revenueThresholdUsd: 100_000,
      hasBlockedReadiness: false,
      hasCriticalPendingReadiness: false,
      hasOpenIncidents: false,
      hasCoordinationErrors: false,
    });
    expect(r).toBe("ESCALATE");
  });
});
