export const PREDICTION_TYPES = [
  "MISSING_EVIDENCE_DELAY",
  "APPROVAL_SLA_RISK",
  "DEPLOYMENT_BLOCKER_RISK",
  "ROLLBACK_RISK",
  "REVENUE_IMPACT_UNDERESTIMATED",
  "DEPENDENCY_DELAY_RISK",
  "HISTORICAL_FAILURE_MATCH",
  "READINESS_DETERIORATING",
] as const;

export type PredictionType = (typeof PREDICTION_TYPES)[number];

export function isPredictionType(s: string): s is PredictionType {
  return (PREDICTION_TYPES as readonly string[]).includes(s);
}
