/**
 * Phase 3 — Policy scope hierarchy.
 */
export type PolicyScope =
  | "global"
  | "org"
  | "environment"
  | "integration"
  | "action"
  | "playbook"
  | "issue_family"
  | "risk_class";

/** Evaluation order: lower index = higher priority */
export const POLICY_SCOPE_ORDER: PolicyScope[] = [
  "global",
  "environment",
  "org",
  "integration",
  "action",
  "playbook",
  "issue_family",
  "risk_class",
];
