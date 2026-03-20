/**
 * Phase 9 — Automation execution envelope (§18).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { ExecutionMode } from "../domain";
import { AutonomyConfidenceBand } from "../domain";
import { createExecutionEnvelope } from "../repositories/automation-execution-envelopes.repository";

export type CreateEnvelopeInput = {
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
};

export async function recordExecutionEnvelope(
  supabase: SupabaseClient,
  input: CreateEnvelopeInput
): Promise<{ envelopeId: string | null; error: Error | null }> {
  const { data, error } = await createExecutionEnvelope(supabase, input);
  if (error) return { envelopeId: null, error };
  return { envelopeId: data?.id ?? null, error: null };
}
