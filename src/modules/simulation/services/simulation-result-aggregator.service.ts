/**
 * Phase 2 — Aggregates step and entity results into summary.
 */
import type { SimulationEntityResultRow } from "../repositories/simulation-entity-results.repository";

export type ResultSummary = {
  projectedRecoveredAmount: number;
  projectedAvoidedAmount: number;
  projectedOperationalSavingsAmount: number;
  affectedIssueCount: number;
  simulatedActionCount: number;
  approvalRequiredCount: number;
  blockedActionCount: number;
};

export function aggregateEntityResults(
  entities: SimulationEntityResultRow[]
): ResultSummary {
  let projectedRecovered = 0;
  let projectedAvoided = 0;
  let projectedSavings = 0;
  let actionCount = 0;
  let approvalCount = 0;
  let blockedCount = 0;
  const issueIds = new Set<string>();

  for (const e of entities) {
    projectedRecovered += e.projected_recovered_amount ?? 0;
    projectedAvoided += e.projected_avoided_amount ?? 0;
    projectedSavings += e.projected_operational_savings_amount ?? 0;
    actionCount += e.action_count ?? 0;
    approvalCount += e.approval_count ?? 0;
    blockedCount += e.blocked_action_count ?? 0;
    if (e.issue_id) issueIds.add(e.issue_id);
  }

  return {
    projectedRecoveredAmount: Math.round(projectedRecovered * 100) / 100,
    projectedAvoidedAmount: Math.round(projectedAvoided * 100) / 100,
    projectedOperationalSavingsAmount: Math.round(projectedSavings * 100) / 100,
    affectedIssueCount: issueIds.size,
    simulatedActionCount: actionCount,
    approvalRequiredCount: approvalCount,
    blockedActionCount: blockedCount,
  };
}
