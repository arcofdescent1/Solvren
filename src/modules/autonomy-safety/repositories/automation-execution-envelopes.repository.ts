/**
 * Phase 9 — automation_execution_envelopes repository.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { ExecutionMode } from "../domain";
import { AutonomyConfidenceBand } from "../domain";

export type AutomationExecutionEnvelopeRow = {
  id: string;
  org_id: string;
  issue_id: string | null;
  workflow_run_id: string | null;
  action_execution_id: string | null;
  action_key: string | null;
  playbook_key: string | null;
  requested_mode: string;
  effective_mode: string;
  autonomy_confidence_score: number;
  autonomy_confidence_band: string;
  policy_decision_log_id: string | null;
  decision_log_id: string | null;
  downgrade_reason_codes_json: unknown;
  execution_status: string;
  created_at: string;
};

export async function createExecutionEnvelope(
  supabase: SupabaseClient,
  input: {
    orgId: string;
    issueId?: string | null;
    workflowRunId?: string | null;
    actionExecutionId?: string | null;
    actionKey?: string | null;
    playbookKey?: string | null;
    requestedMode: ExecutionMode;
    effectiveMode: ExecutionMode;
    autonomyConfidenceScore: number;
    autonomyConfidenceBand: AutonomyConfidenceBand;
    policyDecisionLogId?: string | null;
    decisionLogId?: string | null;
    downgradeReasonCodes: string[];
    executionStatus: string;
  }
): Promise<{ data: AutomationExecutionEnvelopeRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("automation_execution_envelopes")
    .insert({
      org_id: input.orgId,
      issue_id: input.issueId ?? null,
      workflow_run_id: input.workflowRunId ?? null,
      action_execution_id: input.actionExecutionId ?? null,
      action_key: input.actionKey ?? null,
      playbook_key: input.playbookKey ?? null,
      requested_mode: input.requestedMode,
      effective_mode: input.effectiveMode,
      autonomy_confidence_score: input.autonomyConfidenceScore,
      autonomy_confidence_band: input.autonomyConfidenceBand,
      policy_decision_log_id: input.policyDecisionLogId ?? null,
      decision_log_id: input.decisionLogId ?? null,
      downgrade_reason_codes_json: input.downgradeReasonCodes,
      execution_status: input.executionStatus,
    })
    .select()
    .single();

  if (error) return { data: null, error: error as Error };
  return { data: data as AutomationExecutionEnvelopeRow, error: null };
}
