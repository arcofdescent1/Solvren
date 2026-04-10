import type { OutcomeType } from "@/lib/outcomes/types";
import type { PredictionType } from "@/lib/readiness/predictionTypes";

/**
 * Maps Phase 5 prediction_type → Phase 6 outcome_type (same change, same prediction family).
 */
export function outcomeTypeFromPrediction(predictionType: string): OutcomeType | null {
  const p = predictionType as PredictionType;
  switch (p) {
    case "APPROVAL_SLA_RISK":
    case "MISSING_EVIDENCE_DELAY":
      return "APPROVAL_DELAY_AVOIDED";
    case "DEPLOYMENT_BLOCKER_RISK":
    case "DEPENDENCY_DELAY_RISK":
    case "ROLLBACK_RISK":
      return "RELEASE_BLOCKER_AVOIDED";
    case "REVENUE_IMPACT_UNDERESTIMATED":
    case "HISTORICAL_FAILURE_MATCH":
      return "REVENUE_INCIDENT_AVOIDED";
    case "READINESS_DETERIORATING":
      return "READINESS_IMPROVED";
    default:
      return null;
  }
}

/** Same prediction_type match for downstream incident correspondence (spec: family = exact type). */
export function predictionTypesMatch(a: string, b: string): boolean {
  return String(a).toUpperCase() === String(b).toUpperCase();
}
