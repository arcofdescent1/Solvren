import type { AttentionDriverCode } from "@/lib/attention/types";
import { collectAttentionDrivers } from "@/lib/attention/getPrimaryAttentionDriver";
import type { ExecutiveChangeView } from "./types";

function lineForDriver(code: AttentionDriverCode, view: ExecutiveChangeView): string {
  switch (code) {
    case "CONFLICT_JUDGMENT":
      return view.approvalConflictMessage || "Teams disagree on readiness.";
    case "READINESS_BLOCKED_DOMAIN": {
      const blocked = view.readiness.filter((r) => r.status === "BLOCKED");
      return blocked.length
        ? `${blocked[0]!.category} is blocked`
        : "Readiness is blocked";
    }
    case "REVENUE_THRESHOLD":
      return `Revenue exposure meets or exceeds ${view.revenueEscalationThresholdUsd.toLocaleString()} USD threshold`;
    case "OPEN_INCIDENT":
      return "Open incidents are linked to this change";
    case "HIGH_RISK":
      return `Risk is ${view.riskLevel}`;
    case "RECOMMENDATION_ESCALATE":
      return "Recommendation: Escalate";
    case "RECOMMENDATION_DELAY":
      return "Recommendation: Delay";
    case "EXEC_OVERLAY_BLOCK":
      return "Executive follow-up or delay is active";
    case "DEPLOY_URGENCY":
      return "Deployment window is close with unresolved blockers";
    case "DIRECT_APPROVAL_REQUIRED":
      return "Your approval is still required";
    case "DIGEST_FYI":
      return "Some readiness items are still in progress";
    default:
      return "Review summary on Solvren";
  }
}

/** Priority aligned with Phase 2 attention drivers — used for Slack card body. */
export function buildSlackPrimaryConcern(view: ExecutiveChangeView): {
  primary: string;
  moreCount: number;
} {
  const hasExec = view.signoffs.pending.some((p) => p.toUpperCase() === "EXEC");
  const ranked = collectAttentionDrivers({
    view,
    userPendingApprovalAreas: [],
    hasExecSignoffRequired: hasExec,
  });
  if (ranked.length === 0) {
    if (view.recommendation === "PROCEED_WITH_CAUTION") {
      return { primary: "Some readiness items are still in progress", moreCount: 0 };
    }
    return { primary: "Review summary on Solvren", moreCount: 0 };
  }
  const primary = lineForDriver(ranked[0]!.code, view);
  const moreCount = Math.max(0, ranked.length - 1);
  return { primary, moreCount };
}
