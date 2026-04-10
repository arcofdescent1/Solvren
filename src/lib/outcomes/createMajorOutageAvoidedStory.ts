const BASE_CORRECTIVE = new Set([
  "EVIDENCE_PROVIDED",
  "EVIDENCE_UPDATED",
  "APPROVAL_APPROVED",
  "APPROVAL_APPROVED_FROM_SLACK",
  "CHANGE_APPROVED",
  "COORDINATION_EVIDENCE_APPLIED",
  "COMMENT_ADDED",
]);

/**
 * Timeline row qualifies as corrective action for MAJOR_OUTAGE_AVOIDED (expanded vs standard outcomes).
 */
export function isMajorOutageCorrectiveTimelineEvent(eventType: string): boolean {
  const u = eventType.toUpperCase();
  if (BASE_CORRECTIVE.has(u)) return true;
  if (u.includes("ROLLBACK_PLAN")) return true;
  if (u.includes("DEPENDENCY") && (u.includes("RESOLV") || u.includes("MET"))) return true;
  if (u.includes("BLOCKER") && (u.includes("RESOLV") || u.includes("CLEARED"))) return true;
  if (u.includes("RELEASE") && u.includes("DELAY")) return true;
  if (u.includes("REROUT") || u.includes("REROUTE")) return true;
  return false;
}
