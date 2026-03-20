/**
 * Phase 4 — Integration reconciliation checks.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type IntegrationReconciliationCheckRow = {
  id: string;
  org_id: string;
  execution_id: string;
  provider: string;
  reconciliation_type: string;
  check_status: string;
  expected_state_json: Record<string, unknown>;
  observed_state_json: Record<string, unknown> | null;
  attempt_count: number;
  last_error_code: string | null;
  last_error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export async function insertReconciliationCheck(
  supabase: SupabaseClient,
  input: {
    org_id: string;
    execution_id: string;
    provider: string;
    reconciliation_type: string;
    expected_state_json: Record<string, unknown>;
  }
): Promise<{ data: IntegrationReconciliationCheckRow | null; error: Error | null }> {
  const row = {
    org_id: input.org_id,
    execution_id: input.execution_id,
    provider: input.provider,
    reconciliation_type: input.reconciliation_type,
    expected_state_json: input.expected_state_json ?? {},
  };
  const { data, error } = await supabase
    .from("integration_reconciliation_checks")
    .insert(row)
    .select()
    .single();
  if (error) return { data: null, error: error as Error };
  return { data: data as IntegrationReconciliationCheckRow, error: null };
}

export async function listReconciliationChecksForExecution(
  supabase: SupabaseClient,
  executionId: string
): Promise<{ data: IntegrationReconciliationCheckRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("integration_reconciliation_checks")
    .select("*")
    .eq("execution_id", executionId);
  return { data: (data ?? []) as IntegrationReconciliationCheckRow[], error: error as Error | null };
}
