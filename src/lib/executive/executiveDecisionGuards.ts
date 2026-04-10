import type { ExecutiveChangeView, ExecutiveDecisionApi, ExecutiveRecommendation } from "./types";

export type GuardFailure = { code: string; reasons: string[] };

export function validateExecutiveApprove(view: ExecutiveChangeView): GuardFailure | null {
  const reasons: string[] = [];

  if (view.readiness.some((r) => r.status === "BLOCKED")) {
    reasons.push(
      ...view.readiness
        .filter((r) => r.status === "BLOCKED")
        .map((r) => `${r.category} is BLOCKED`)
    );
  }

  if (view.hasApprovalConflict && view.approvalConflictMessage) {
    reasons.push(view.approvalConflictMessage);
  }

  if (view.executiveOverlay === "DELAYED") {
    reasons.push("An executive delay is active for this change.");
  }
  if (view.executiveOverlay === "REQUESTED_INFO") {
    reasons.push("Executive follow-up is still pending.");
  }
  if (view.executiveOverlay === "ESCALATED") {
    reasons.push("This change is in an executive-escalated state.");
  }

  if (
    view.recommendation === "DELAY" ||
    view.recommendation === "ESCALATE"
  ) {
    reasons.push(`Recommendation is ${view.recommendation.replace(/_/g, " ")}`);
  }

  if (reasons.length === 0) return null;
  return { code: "EXECUTIVE_APPROVAL_BLOCKED", reasons };
}

export function validateExecutiveDecisionPayload(
  decision: ExecutiveDecisionApi,
  comment: string | null | undefined
): string | null {
  if (decision === "DELAY" || decision === "ESCALATE" || decision === "REQUEST_INFO") {
    if (!comment || !String(comment).trim()) {
      return "Comment is required for this decision.";
    }
  }
  return null;
}

export function recommendationBlocksApiApprove(rec: ExecutiveRecommendation): boolean {
  return rec === "DELAY" || rec === "ESCALATE";
}
