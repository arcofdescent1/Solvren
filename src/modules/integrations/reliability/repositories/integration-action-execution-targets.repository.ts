/**
 * Phase 4 — Integration action execution targets (bulk/partial).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type IntegrationActionExecutionTargetRow = {
  id: string;
  execution_id: string;
  target_key: string;
  target_ref_json: Record<string, unknown>;
  target_status: string;
  attempt_count: number;
  provider_response_json: Record<string, unknown> | null;
  last_error_code: string | null;
  last_error_message: string | null;
  created_at: string;
  updated_at: string;
};

export async function insertExecutionTargets(
  supabase: SupabaseClient,
  executionId: string,
  targets: Array<{ target_key: string; target_ref_json: Record<string, unknown> }>
): Promise<{ data: IntegrationActionExecutionTargetRow[]; error: Error | null }> {
  const rows = targets.map((t) => ({
    execution_id: executionId,
    target_key: t.target_key,
    target_ref_json: t.target_ref_json ?? {},
  }));
  const { data, error } = await supabase
    .from("integration_action_execution_targets")
    .insert(rows)
    .select();
  return { data: (data ?? []) as IntegrationActionExecutionTargetRow[], error: error as Error | null };
}

export async function listExecutionTargets(
  supabase: SupabaseClient,
  executionId: string
): Promise<{ data: IntegrationActionExecutionTargetRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("integration_action_execution_targets")
    .select("*")
    .eq("execution_id", executionId);
  return { data: (data ?? []) as IntegrationActionExecutionTargetRow[], error: error as Error | null };
}

export async function updateExecutionTarget(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<{
    target_status: string;
    attempt_count: number;
    provider_response_json: Record<string, unknown> | null;
    last_error_code: string | null;
    last_error_message: string | null;
  }>
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("integration_action_execution_targets")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);
  return { error: error as Error | null };
}
