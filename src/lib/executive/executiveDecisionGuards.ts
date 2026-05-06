import type { ExecutiveChangeView, ExecutiveDecisionApi, ExecutiveRecommendation } from "./types";

export type GuardFailure = { code: string; reasons: string[] };

/**
 * Executive overlay APPROVE is always allowed (directional sign-off).
 * Domain approvals, evidence, and readiness still gate release.
 */
export function validateExecutiveApprove(_view: ExecutiveChangeView): GuardFailure | null {
  return null;
}

export function validateExecutiveDecisionPayload(
  decision: ExecutiveDecisionApi,
  comment: string | null | undefined
): string | null {
  const c = comment != null ? String(comment).trim() : "";
  if (decision === "DENY" || decision === "ESCALATE" || decision === "REQUEST_INFO") {
    if (!c) return "Comment is required for this decision.";
  }
  return null;
}

export function recommendationBlocksApiApprove(rec: ExecutiveRecommendation): boolean {
  return rec === "DELAY" || rec === "ESCALATE";
}
