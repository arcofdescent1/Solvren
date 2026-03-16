export type RiskBucket =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "VERY_HIGH"
  | "CRITICAL";

export type EvidenceKind =
  | "PR"
  | "RUNBOOK"
  | "DASHBOARD"
  | "ROLLBACK"
  | "TEST_PLAN"
  | "COMMS_PLAN"
  | "OTHER";

export const REQUIRED_EVIDENCE_BY_BUCKET: Record<RiskBucket, EvidenceKind[]> =
  {
    LOW: [],
    MEDIUM: ["PR"],
    HIGH: ["PR", "TEST_PLAN"],
    VERY_HIGH: ["PR", "TEST_PLAN", "RUNBOOK", "ROLLBACK"],
    CRITICAL: [
      "PR",
      "TEST_PLAN",
      "RUNBOOK",
      "ROLLBACK",
      "DASHBOARD",
      "COMMS_PLAN",
    ],
  };

export const EVIDENCE_KIND_LABEL: Record<EvidenceKind, string> = {
  PR: "PR / Change Diff",
  TEST_PLAN: "Test Plan",
  RUNBOOK: "Runbook / Release Plan",
  ROLLBACK: "Rollback Plan",
  DASHBOARD: "Validation Dashboard",
  COMMS_PLAN: "Customer Comms Plan",
  OTHER: "Other",
};
