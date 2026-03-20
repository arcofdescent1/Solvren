/**
 * Phase 1 — Lifecycle validation result types.
 */
export type LifecycleValidationResult = {
  allowed: boolean;
  reasonCode?: LifecycleValidationReasonCode;
  message?: string;
};

export type LifecycleValidationReasonCode =
  | "invalid_transition"
  | "missing_impact_assessment"
  | "missing_action_attempt"
  | "missing_verification_attempt"
  | "missing_terminal_classification"
  | "missing_no_action_decision"
  | "approval_required"
  | "issue_already_closed"
  | "lifecycle_version_conflict"
  | "duplicate_no_action_decision";
