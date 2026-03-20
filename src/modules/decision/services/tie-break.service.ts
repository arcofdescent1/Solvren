/**
 * Phase 5 — Tie-break service (§15).
 * Deterministic sort: weightedScore desc, riskPenalty asc, historicalSuccess desc,
 * frictionPenalty asc, actionKey asc.
 */
import type { RankedAction } from "../domain/ranked-action";

export function sortRankedActions(actions: RankedAction[]): RankedAction[] {
  return [...actions].sort((a, b) => {
    if (b.weightedScore !== a.weightedScore) return b.weightedScore - a.weightedScore;
    if (a.featureBreakdown.riskPenaltyNorm !== b.featureBreakdown.riskPenaltyNorm)
      return a.featureBreakdown.riskPenaltyNorm - b.featureBreakdown.riskPenaltyNorm;
    if (b.featureBreakdown.historicalSuccessNorm !== a.featureBreakdown.historicalSuccessNorm)
      return b.featureBreakdown.historicalSuccessNorm - a.featureBreakdown.historicalSuccessNorm;
    if (a.featureBreakdown.frictionPenaltyNorm !== b.featureBreakdown.frictionPenaltyNorm)
      return a.featureBreakdown.frictionPenaltyNorm - b.featureBreakdown.frictionPenaltyNorm;
    return String(a.actionKey).localeCompare(String(b.actionKey));
  });
}

export function assignRanks(actions: RankedAction[]): RankedAction[] {
  return actions.map((a, i) => ({ ...a, rank: i + 1 }));
}
