/**
 * Phase 9 — Downgrade and pause reason codes (§15).
 */
export const DOWNGRADE_REASON_CODES = [
  "policy_blocked",
  "policy_requires_approval",
  "low_autonomy_confidence",
  "medium_autonomy_confidence",
  "connector_auth_failed",
  "connector_writeback_degraded",
  "verification_unreliable",
  "high_rollback_rate",
  "high_partial_failure_rate",
  "insufficient_historical_success",
  "missing_required_inputs",
  "environment_ceiling",
  "hard_stop_pause",
  "scoped_pause",
  "action_not_autoable",
  "playbook_not_autoable",
] as const;

export type DowngradeReasonCode = (typeof DOWNGRADE_REASON_CODES)[number];
