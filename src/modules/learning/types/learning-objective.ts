/**
 * Phase 6 — Constrained multi-objective framework (documentation-aligned).
 * Primary: reduce false allows/blocks and unnecessary approvals.
 * Guardrails: safety, revenue protection, explainability.
 */

export type DecisionQualityMetricKey =
  | "false_allow_rate"
  | "false_block_rate"
  | "unnecessary_approval_rate"
  | "missed_approval_rate";

export type OperationalMetricKey =
  | "approval_latency_ms_p50"
  | "manual_override_rate"
  | "dead_letter_burden"
  | "action_to_resolution_latency_ms";

export type OutcomeMetricKey =
  | "recovered_revenue_proxy"
  | "repeat_incident_rate"
  | "recurrence_after_allow";

export type LearningObjectiveGroup = {
  primary: DecisionQualityMetricKey[];
  guardrails: string[];
  secondary: (OperationalMetricKey | OutcomeMetricKey)[];
};

export const PHASE6_V1_OBJECTIVES: LearningObjectiveGroup = {
  primary: ["false_allow_rate", "false_block_rate", "unnecessary_approval_rate", "missed_approval_rate"],
  guardrails: [
    "safety_compliance_posture",
    "revenue_protection",
    "customer_visible_incident_rate",
    "policy_explainability",
  ],
  secondary: [
    "approval_latency_ms_p50",
    "manual_override_rate",
    "dead_letter_burden",
    "repeat_incident_rate",
  ],
};
