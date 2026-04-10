import type { ExecutiveRiskLevel, ReadinessRow, SignoffSummary } from "./types";

export type ConfidenceInput = {
  readiness: ReadinessRow[];
  signoffs: SignoffSummary;
  hasApprovalConflict: boolean;
  hasOpenIncidents: boolean;
  hasRollbackReady: boolean;
  hasMonitoringReady: boolean;
  riskLevel: ExecutiveRiskLevel;
};

export function computeExecutiveConfidence(input: ConfidenceInput): number {
  let score = 55;
  const readyN = input.readiness.filter((r) => r.status === "READY").length;
  score += Math.min(25, readyN * 3);
  const pendingN = input.readiness.filter((r) => r.status === "PENDING").length;
  score -= pendingN * 2;
  const blockedN = input.readiness.filter((r) => r.status === "BLOCKED").length;
  score -= blockedN * 12;
  if (input.signoffs.rejected.length > 0) score -= 15;
  if (input.hasApprovalConflict) score -= 20;
  if (input.hasOpenIncidents) score -= 10;
  if (input.hasRollbackReady) score += 5;
  if (input.hasMonitoringReady) score += 5;
  if (input.riskLevel === "LOW") score += 8;
  if (input.riskLevel === "HIGH" || input.riskLevel === "CRITICAL") score -= 12;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function confidenceLabel(
  score: number
): "High confidence" | "Moderate confidence" | "Low confidence" {
  if (score >= 80) return "High confidence";
  if (score >= 60) return "Moderate confidence";
  return "Low confidence";
}
