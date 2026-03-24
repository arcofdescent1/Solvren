/**
 * Phase 6 — Summaries for recommendation-grade runs (real evaluateGovernance).
 */
import type { GovernanceDecision } from "@/modules/governance";

export type SimulationSummary = {
  mode: "production_grade" | "exploratory";
  disposition: GovernanceDecision["disposition"];
  traceId: string;
  matchedPolicyCount: number;
  matchedRuleCount: number;
  headline: string;
};

export function buildSimulationSummaryFromGovernanceDecision(
  decision: GovernanceDecision,
  mode: SimulationSummary["mode"]
): SimulationSummary {
  return {
    mode,
    disposition: decision.disposition,
    traceId: decision.traceId,
    matchedPolicyCount: decision.matchedPolicyIds.length,
    matchedRuleCount: decision.matchedRuleIds.length,
    headline: decision.explainability.headline,
  };
}
