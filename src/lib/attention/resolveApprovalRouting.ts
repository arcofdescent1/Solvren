import type { AttentionContext } from "./types";

export type ApprovalRoutingAdvisory = {
  shouldInterruptExecutiveNow: boolean;
  shouldInterruptSeniorTechNow: boolean;
  notes: string;
};

/**
 * Phase 2 — routing advisory only; does not create or cancel approval rows.
 */
export function resolveApprovalRouting(ctx: AttentionContext): ApprovalRoutingAdvisory {
  const v = ctx.view;
  const execRequired = ctx.executiveSignoffRequired;
  const urgent =
    v.riskLevel === "HIGH" ||
    v.riskLevel === "CRITICAL" ||
    v.recommendation === "ESCALATE" ||
    v.recommendation === "DELAY" ||
    v.hasApprovalConflict ||
    v.readiness.some((r) => r.status === "BLOCKED");

  return {
    shouldInterruptExecutiveNow: execRequired && urgent,
    shouldInterruptSeniorTechNow: urgent,
    notes: execRequired
      ? "Executive approval is on file for this change; urgency follows risk and readiness."
      : "No pending executive approval area; thresholds control visibility only.",
  };
}
