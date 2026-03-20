/**
 * Phase 1 — Approved no-action reasons (enum only; no arbitrary strings).
 */
export const NO_ACTION_REASONS = [
  "false_positive",
  "duplicate_of_existing_issue",
  "accepted_business_risk",
  "insufficient_permissions",
  "external_blocker_unresolvable",
  "customer_declined_action",
  "informational_only",
  "test_or_demo_artifact",
] as const;

export type NoActionReason = (typeof NO_ACTION_REASONS)[number];

export function isValidNoActionReason(s: string): s is NoActionReason {
  return (NO_ACTION_REASONS as readonly string[]).includes(s);
}
