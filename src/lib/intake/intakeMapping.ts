/**
 * Phase 3 — IntakeRecordType → domain / change_type (status is always DRAFT until submit).
 */
export type IntakeRecordType =
  | "CHANGE_REQUEST"
  | "OPERATIONAL_RISK"
  | "READINESS_CONCERN"
  | "DEPLOYMENT_BLOCKER"
  | "OTHER";

export function parseIntakeRecordType(raw: string | null | undefined): IntakeRecordType {
  const u = String(raw ?? "OTHER").trim().toUpperCase().replace(/ /g, "_");
  if (
    u === "CHANGE_REQUEST" ||
    u === "OPERATIONAL_RISK" ||
    u === "READINESS_CONCERN" ||
    u === "DEPLOYMENT_BLOCKER" ||
    u === "OTHER"
  ) {
    return u;
  }
  return "OTHER";
}

export function intakeDomainAndChangeType(
  t: IntakeRecordType
): { domain: string; change_type: string } {
  switch (t) {
    case "OPERATIONAL_RISK":
      return { domain: "OPERATIONS", change_type: "OTHER" };
    case "DEPLOYMENT_BLOCKER":
      return { domain: "REVENUE", change_type: "INCIDENT" };
    case "CHANGE_REQUEST":
    case "READINESS_CONCERN":
    case "OTHER":
    default:
      return { domain: "REVENUE", change_type: "OTHER" };
  }
}

export function mapUserSeverityToRiskBucket(
  raw: string | null | undefined
): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  const u = String(raw ?? "MEDIUM").trim().toUpperCase();
  if (u === "LOW" || u === "MEDIUM" || u === "HIGH" || u === "CRITICAL") return u;
  return "MEDIUM";
}
