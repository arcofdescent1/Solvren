import type { AttentionDriverCode } from "./types";

const SHORT: Record<AttentionDriverCode, string> = {
  DIRECT_APPROVAL_REQUIRED: "Your approval is required before this change can proceed.",
  CONFLICT_JUDGMENT: "Teams disagree on readiness; your judgment is needed.",
  READINESS_BLOCKED_DOMAIN: "Readiness is blocked; deployment risk is elevated.",
  EXEC_OVERLAY_BLOCK: "An executive decision is blocking or requesting more information.",
  HIGH_RISK: "Risk level is high for this change.",
  RECOMMENDATION_ESCALATE: "Recommendation is to escalate this change.",
  RECOMMENDATION_DELAY: "Recommendation is to delay until issues are resolved.",
  REVENUE_THRESHOLD: "Revenue exposure crosses your org threshold.",
  DEPLOY_URGENCY: "Deployment is near with unresolved blockers.",
  OPEN_INCIDENT: "Open incidents are linked to this change.",
  DIGEST_FYI: "Worth a quick read before go-live.",
  ROUTINE: "Routine visibility on this change.",
};

const BULLET: Record<AttentionDriverCode, string> = {
  DIRECT_APPROVAL_REQUIRED: "Your sign-off is still required on this change.",
  CONFLICT_JUDGMENT: "Approval conflict: teams are not aligned on readiness.",
  READINESS_BLOCKED_DOMAIN: "One or more readiness areas are blocked.",
  EXEC_OVERLAY_BLOCK: "Executive follow-up or delay is active on this change.",
  HIGH_RISK: "Risk is elevated relative to normal releases.",
  RECOMMENDATION_ESCALATE: "Solvren recommends escalation given current signals.",
  RECOMMENDATION_DELAY: "Solvren recommends delaying until gaps are closed.",
  REVENUE_THRESHOLD: "Estimated revenue exposure meets or exceeds the escalation threshold.",
  DEPLOY_URGENCY: "Scheduled deployment window is close with open issues.",
  OPEN_INCIDENT: "There are open incidents linked to this change.",
  DIGEST_FYI: "Some readiness items are still in progress.",
  ROUTINE: "Standard executive visibility on this change.",
};

export function shortInterruptionLine(code: AttentionDriverCode): string {
  const s = SHORT[code] ?? SHORT.ROUTINE;
  return s.length > 120 ? `${s.slice(0, 117)}...` : s;
}

export function bulletForDriver(code: AttentionDriverCode): string {
  return BULLET[code] ?? BULLET.ROUTINE;
}
