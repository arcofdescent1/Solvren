/**
 * Phase 5 — Confidence scorer (§11).
 */
import { getConfidenceBand } from "../domain/confidence-score";

export function computeConfidenceScore(inputs: {
  hasDirectAmount: boolean;
  hasOrgAssumptions: boolean;
  signalQuality: number;
  entityLinkConfidence: number;
  dataFreshnessHours?: number;
}): { score: number; explanation: Record<string, unknown> } {
  let score = 50;
  const factors: string[] = [];

  if (inputs.hasDirectAmount) {
    score += 25;
    factors.push("direct_financial_evidence");
  }
  if (inputs.hasOrgAssumptions) {
    score += 15;
    factors.push("org_specific_assumptions");
  }
  if (inputs.signalQuality >= 0.8) {
    score += 10;
    factors.push("high_signal_quality");
  } else if (inputs.signalQuality >= 0.5) {
    score += 5;
    factors.push("moderate_signal_quality");
  }
  if (inputs.entityLinkConfidence >= 0.9) {
    score += 5;
    factors.push("strong_entity_linkage");
  }
  if (inputs.dataFreshnessHours != null && inputs.dataFreshnessHours < 24) {
    score += 5;
    factors.push("fresh_data");
  }

  score = Math.min(100, Math.max(0, score));
  const band = getConfidenceBand(score);

  return {
    score,
    explanation: {
      score,
      band,
      factors,
    },
  };
}
