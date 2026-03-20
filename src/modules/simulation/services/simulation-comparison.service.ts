/**
 * Phase 2 — Compare baseline vs candidate simulation runs.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSimulationRun } from "../repositories/simulation-runs.repository";
import { insertComparison } from "../repositories/simulation-comparisons.repository";

export type ComparisonResult = {
  baselineRunId: string;
  candidateRunId: string;
  deltas: {
    projectedRecoveredAmount: number;
    projectedAvoidedAmount: number;
    projectedOperationalSavingsAmount: number;
    affectedIssueCount: number;
    simulatedActionCount: number;
    approvalRequiredCount: number;
    blockedActionCount: number;
  };
  summary: string;
};

export async function compareSimulations(
  supabase: SupabaseClient,
  orgId: string,
  baselineRunId: string,
  candidateRunId: string
): Promise<{ data: ComparisonResult | null; error: Error | null }> {
  const { data: baseline } = await getSimulationRun(supabase, baselineRunId);
  const { data: candidate } = await getSimulationRun(supabase, candidateRunId);

  if (!baseline || baseline.org_id !== orgId) {
    return { data: null, error: new Error("Baseline run not found or wrong org") };
  }
  if (!candidate || candidate.org_id !== orgId) {
    return { data: null, error: new Error("Candidate run not found or wrong org") };
  }

  const b = (baseline.result_summary_json ?? {}) as Record<string, number>;
  const c = (candidate.result_summary_json ?? {}) as Record<string, number>;

  const deltas = {
    projectedRecoveredAmount: (c.projectedRecoveredAmount ?? 0) - (b.projectedRecoveredAmount ?? 0),
    projectedAvoidedAmount: (c.projectedAvoidedAmount ?? 0) - (b.projectedAvoidedAmount ?? 0),
    projectedOperationalSavingsAmount: (c.projectedOperationalSavingsAmount ?? 0) - (b.projectedOperationalSavingsAmount ?? 0),
    affectedIssueCount: (c.affectedIssueCount ?? 0) - (b.affectedIssueCount ?? 0),
    simulatedActionCount: (c.simulatedActionCount ?? 0) - (b.simulatedActionCount ?? 0),
    approvalRequiredCount: (c.approvalRequiredCount ?? 0) - (b.approvalRequiredCount ?? 0),
    blockedActionCount: (c.blockedActionCount ?? 0) - (b.blockedActionCount ?? 0),
  };

  const parts: string[] = [];
  if (deltas.projectedRecoveredAmount !== 0) {
    parts.push(`projected recovered ${deltas.projectedRecoveredAmount >= 0 ? "+" : ""}$${deltas.projectedRecoveredAmount.toLocaleString()}`);
  }
  if (deltas.projectedAvoidedAmount !== 0) {
    parts.push(`avoided ${deltas.projectedAvoidedAmount >= 0 ? "+" : ""}$${deltas.projectedAvoidedAmount.toLocaleString()}`);
  }
  if (deltas.approvalRequiredCount !== 0) {
    parts.push(`approvals ${deltas.approvalRequiredCount >= 0 ? "+" : ""}${deltas.approvalRequiredCount}`);
  }
  const summary = parts.length > 0
    ? `Candidate ${parts.join(", ")} vs baseline.`
    : "No significant deltas between runs.";

  const { data: comp } = await insertComparison(supabase, {
    org_id: orgId,
    baseline_run_id: baselineRunId,
    candidate_run_id: candidateRunId,
    comparison_type: "policy_comparison",
    comparison_result_json: { deltas, summary },
  });

  return {
    data: { baselineRunId, candidateRunId, deltas, summary },
    error: comp ? null : new Error("Failed to persist comparison"),
  };
}
