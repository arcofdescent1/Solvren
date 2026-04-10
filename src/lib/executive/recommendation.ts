import type { ExecutiveRecommendation, ExecutiveRiskLevel, ReadinessRow } from "./types";

export type RecommendationContext = {
  riskLevel: ExecutiveRiskLevel;
  readiness: ReadinessRow[];
  hasApprovalConflict: boolean;
  revenueAtRiskMonthly: number | null;
  revenueThresholdUsd: number;
  /** Any readiness row BLOCKED */
  hasBlockedReadiness: boolean;
  /** Pending on Support, Finance, or Rollback Plan */
  hasCriticalPendingReadiness: boolean;
  /** Open incidents linked to change */
  hasOpenIncidents: boolean;
  /** Coordination plan ERROR blockers */
  hasCoordinationErrors: boolean;
};

export function getExecutiveRecommendation(ctx: RecommendationContext): ExecutiveRecommendation {
  const revenueEscalates =
    ctx.revenueAtRiskMonthly != null &&
    ctx.revenueAtRiskMonthly >= ctx.revenueThresholdUsd;

  if (ctx.hasApprovalConflict || revenueEscalates) {
    return "ESCALATE";
  }

  if (ctx.hasBlockedReadiness || ctx.hasCoordinationErrors) {
    return "DELAY";
  }

  if (
    ctx.riskLevel === "HIGH" ||
    ctx.riskLevel === "CRITICAL" ||
    (ctx.hasOpenIncidents && ctx.riskLevel === "MEDIUM")
  ) {
    return "DELAY";
  }

  if (ctx.riskLevel === "MEDIUM" && ctx.hasCriticalPendingReadiness) {
    return "PROCEED_WITH_CAUTION";
  }

  if (ctx.riskLevel === "MEDIUM") {
    const pendingCount = ctx.readiness.filter((r) => r.status === "PENDING").length;
    if (pendingCount >= 1) return "PROCEED_WITH_CAUTION";
  }

  return "PROCEED";
}
