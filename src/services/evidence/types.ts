export type EvidenceKind =
  | "TEST_PLAN"
  | "ROLLBACK"
  | "RUNBOOK"
  | "DASHBOARD"
  | "COMMS_PLAN"
  | "PR"
  | "MONITORING_PLAN"
  | "REVENUE_VALIDATION"
  | "DATA_BACKFILL_PLAN"
  | "OTHER";

export type EvidenceSeverity = "REQUIRED" | "RECOMMENDED";
export type EvidenceItemStatus = "MISSING" | "PROVIDED" | "WAIVED";

export type EvidenceRequirement = {
  kind: EvidenceKind;
  label: string;
  severity: EvidenceSeverity;
};
