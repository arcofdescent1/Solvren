/**
 * Phase 5 — Feature breakdown for ranked actions (§11).
 */
export type FeatureBreakdown = {
  impactNorm: number;
  confidenceNorm: number;
  historicalSuccessNorm: number;
  urgencyNorm: number;
  policyPreferenceNorm: number;
  strategicBoostNorm: number;
  riskPenaltyNorm: number;
  frictionPenaltyNorm: number;
  cooldownPenaltyNorm: number;
};
