import type { ConfidenceLevel, OutcomeType } from "@/lib/outcomes/types";
import { DURATION_FACTOR_BY_OUTCOME, PREVENTION_CONFIDENCE_BY_LEVEL } from "@/lib/outcomes/types";

/**
 * revenue_at_risk = monthly MRR at risk × impact duration (months), default 1 month.
 * revenue_protected = revenue_at_risk × prevention_confidence × duration_factor (capped).
 */
export function computeRevenueProtected(args: {
  estimatedMrrAffected: number;
  impactDurationMonths: number;
  confidenceLevel: ConfidenceLevel;
  outcomeType: OutcomeType;
}): number {
  const mrr = Math.max(0, Number(args.estimatedMrrAffected) || 0);
  const months = Math.max(0.25, Math.min(12, Number(args.impactDurationMonths) || 1));
  const revenueAtRisk = mrr * months;
  const prev = PREVENTION_CONFIDENCE_BY_LEVEL[args.confidenceLevel];
  const dur = DURATION_FACTOR_BY_OUTCOME[args.outcomeType];
  const raw = revenueAtRisk * prev * dur;
  const cap = mrr * 12;
  return Math.round(Math.min(raw, cap));
}
