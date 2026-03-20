/**
 * Phase 9 — autonomy_decision_states repository.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { ExecutionMode } from "../domain";
import { AutonomyConfidenceBand } from "../domain";

export type AutonomyDecisionStateRow = {
  id: string;
  org_id: string;
  issue_id: string | null;
  workflow_run_id: string | null;
  action_key: string | null;
  playbook_key: string | null;
  requested_mode: string;
  effective_mode: string;
  autonomy_confidence_score: number;
  autonomy_confidence_band: string;
  downgrade_reason_codes_json: unknown;
  pause_reason_codes_json: unknown;
  supporting_metrics_json: unknown;
  created_at: string;
};

export async function insertAutonomyDecisionState(
  supabase: SupabaseClient,
  input: {
    orgId: string;
    issueId?: string | null;
    workflowRunId?: string | null;
    actionKey?: string | null;
    playbookKey?: string | null;
    requestedMode: ExecutionMode;
    effectiveMode: ExecutionMode;
    autonomyConfidenceScore: number;
    autonomyConfidenceBand: AutonomyConfidenceBand;
    downgradeReasonCodes: string[];
    pauseReasonCodes: string[];
    supportingMetrics?: Record<string, unknown>;
  }
): Promise<{ data: AutonomyDecisionStateRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("autonomy_decision_states")
    .insert({
      org_id: input.orgId,
      issue_id: input.issueId ?? null,
      workflow_run_id: input.workflowRunId ?? null,
      action_key: input.actionKey ?? null,
      playbook_key: input.playbookKey ?? null,
      requested_mode: input.requestedMode,
      effective_mode: input.effectiveMode,
      autonomy_confidence_score: input.autonomyConfidenceScore,
      autonomy_confidence_band: input.autonomyConfidenceBand,
      downgrade_reason_codes_json: input.downgradeReasonCodes,
      pause_reason_codes_json: input.pauseReasonCodes,
      supporting_metrics_json: input.supportingMetrics ?? {},
    })
    .select()
    .single();

  if (error) return { data: null, error: error as Error };
  return { data: data as AutonomyDecisionStateRow, error: null };
}
