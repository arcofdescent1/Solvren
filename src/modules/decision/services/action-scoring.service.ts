/**
 * Phase 5 — Action scoring service (§11).
 * Applies weighted formula to compute final score.
 */
import type { FeatureBreakdown } from "../domain/feature-breakdown";

export type ScoringWeights = {
  impact?: number;
  confidence?: number;
  historicalSuccess?: number;
  urgency?: number;
  policyPreference?: number;
  strategicBoost?: number;
  riskPenalty?: number;
  frictionPenalty?: number;
  cooldownPenalty?: number;
};

const DEFAULT_WEIGHTS: Required<ScoringWeights> = {
  impact: 0.3,
  confidence: 0.2,
  historicalSuccess: 0.2,
  urgency: 0.15,
  policyPreference: 0.05,
  strategicBoost: 0.05,
  riskPenalty: 0.1,
  frictionPenalty: 0.05,
  cooldownPenalty: 0.05,
};

/**
 * weightedScore =
 *   0.30 * impactNorm + 0.20 * confidenceNorm + 0.20 * historicalSuccessNorm
 *   + 0.15 * urgencyNorm + 0.05 * policyPreferenceNorm + 0.05 * strategicBoostNorm
 *   - 0.10 * riskPenaltyNorm - 0.05 * frictionPenaltyNorm - 0.05 * cooldownPenaltyNorm
 */
export function computeWeightedScore(
  breakdown: FeatureBreakdown,
  weights?: ScoringWeights | null
): number {
  const w = { ...DEFAULT_WEIGHTS, ...weights };
  const raw =
    w.impact * breakdown.impactNorm +
    w.confidence * breakdown.confidenceNorm +
    w.historicalSuccess * breakdown.historicalSuccessNorm +
    w.urgency * breakdown.urgencyNorm +
    w.policyPreference * breakdown.policyPreferenceNorm +
    w.strategicBoost * breakdown.strategicBoostNorm -
    w.riskPenalty * breakdown.riskPenaltyNorm -
    w.frictionPenalty * breakdown.frictionPenaltyNorm -
    w.cooldownPenalty * breakdown.cooldownPenaltyNorm;
  return Math.round(Math.max(0, Math.min(100, raw)) * 100) / 100;
}
