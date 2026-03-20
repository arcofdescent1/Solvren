/**
 * Phase 4 — Integration action executions (authoritative outbound).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type IntegrationActionExecutionRow = {
  id: string;
  org_id: string;
  integration_account_id: string;
  issue_id: string | null;
  workflow_run_id: string | null;
  provider: string;
  action_key: string;
  target_ref_json: Record<string, unknown>;
  request_payload_json: Record<string, unknown>;
  idempotency_key: string;
  execution_status: string;
  risk_level: string | null;
  attempt_count: number;
  max_attempts: number;
  provider_response_code: string | null;
  provider_response_json: Record<string, unknown> | null;
  last_error_code: string | null;
  last_error_message: string | null;
  reconciliation_required: boolean;
  reconciliation_status: string;
  created_at: string;
  updated_at: string;
};

export type InsertActionExecutionInput = {
  org_id: string;
  integration_account_id: string;
  issue_id?: string | null;
  workflow_run_id?: string | null;
  provider: string;
  action_key: string;
  target_ref_json?: Record<string, unknown>;
  request_payload_json?: Record<string, unknown>;
  idempotency_key: string;
  risk_level?: string | null;
  max_attempts?: number;
  reconciliation_required?: boolean;
};

export async function insertActionExecution(
  supabase: SupabaseClient,
  input: InsertActionExecutionInput
): Promise<{ data: IntegrationActionExecutionRow | null; error: Error | null }> {
  const row = {
    org_id: input.org_id,
    integration_account_id: input.integration_account_id,
    issue_id: input.issue_id ?? null,
    workflow_run_id: input.workflow_run_id ?? null,
    provider: input.provider,
    action_key: input.action_key,
    target_ref_json: input.target_ref_json ?? {},
    request_payload_json: input.request_payload_json ?? {},
    idempotency_key: input.idempotency_key,
    risk_level: input.risk_level ?? null,
    max_attempts: input.max_attempts ?? 4,
    reconciliation_required: input.reconciliation_required ?? false,
  };
  const { data, error } = await supabase
    .from("integration_action_executions")
    .insert(row)
    .select()
    .single();
  if (error) return { data: null, error: error as Error };
  return { data: data as IntegrationActionExecutionRow, error: null };
}

export async function findActionExecutionByIdempotencyKey(
  supabase: SupabaseClient,
  orgId: string,
  provider: string,
  idempotencyKey: string
): Promise<{ data: IntegrationActionExecutionRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("integration_action_executions")
    .select("*")
    .eq("org_id", orgId)
    .eq("provider", provider)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  return { data: data as IntegrationActionExecutionRow | null, error: error as Error | null };
}

export async function getActionExecution(
  supabase: SupabaseClient,
  id: string
): Promise<{ data: IntegrationActionExecutionRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("integration_action_executions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return { data: data as IntegrationActionExecutionRow | null, error: error as Error | null };
}

export async function listActionExecutions(
  supabase: SupabaseClient,
  orgId: string,
  filters?: { provider?: string; status?: string; issueId?: string; reconciliationStatus?: string },
  limit = 50
): Promise<{ data: IntegrationActionExecutionRow[]; error: Error | null }> {
  let q = supabase
    .from("integration_action_executions")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (filters?.provider) q = q.eq("provider", filters.provider);
  if (filters?.status) q = q.eq("execution_status", filters.status);
  if (filters?.issueId) q = q.eq("issue_id", filters.issueId);
  if (filters?.reconciliationStatus) q = q.eq("reconciliation_status", filters.reconciliationStatus);
  const { data, error } = await q;
  return { data: (data ?? []) as IntegrationActionExecutionRow[], error: error as Error | null };
}

export async function updateActionExecution(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<{
    execution_status: string;
    attempt_count: number;
    provider_response_code: string | null;
    provider_response_json: Record<string, unknown> | null;
    last_error_code: string | null;
    last_error_message: string | null;
    reconciliation_status: string;
  }>
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("integration_action_executions")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);
  return { error: error as Error | null };
}
