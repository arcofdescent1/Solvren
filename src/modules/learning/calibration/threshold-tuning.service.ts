/**
 * Phase 6 — Bounded numeric threshold proposals (percentile / simple stats).
 */
import type { GovernanceDecisionFact } from "../data/governance-decision-facts.service";

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[idx]!;
}

export type ThresholdProposal = {
  parameterKey: string;
  currentValue: number | null;
  proposedValue: number;
  minBound: number;
  maxBound: number;
  method: "p95_impact_amount_on_allow";
  sampleSize: number;
};

/**
 * Example v1 heuristic: propose amount threshold near p95 of observed impact amounts on ALLOW dispositions.
 */
export function proposeImpactThresholdFromFacts(
  facts: GovernanceDecisionFact[],
  bounds: { min: number; max: number }
): ThresholdProposal | null {
  const amounts = facts
    .filter((f) => f.disposition === "ALLOW" && f.impact_amount != null && f.impact_amount > 0)
    .map((f) => f.impact_amount!)
    .sort((a, b) => a - b);

  if (amounts.length < 5) return null;

  const proposed = percentile(amounts, 0.95);
  const clamped = Math.min(bounds.max, Math.max(bounds.min, proposed));

  return {
    parameterKey: "impact_amount_threshold",
    currentValue: null,
    proposedValue: clamped,
    minBound: bounds.min,
    maxBound: bounds.max,
    method: "p95_impact_amount_on_allow",
    sampleSize: amounts.length,
  };
}
