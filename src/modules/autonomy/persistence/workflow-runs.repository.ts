/**
 * Phase 8 — workflow_runs, workflow_step_runs persistence.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type WorkflowRunRow = {
  id: string;
  org_id: string;
  playbook_definition_id: string;
  issue_id: string | null;
  finding_id: string | null;
  entry_signal_id: string | null;
  run_status: string;
  current_step_key: string | null;
  autonomy_mode: string;
  policy_snapshot_json: Record<string, unknown>;
  input_snapshot_json: Record<string, unknown>;
  started_at: string;
  completed_at: string | null;
  created_at: string;
};

export type WorkflowStepRunRow = {
  id: string;
  workflow_run_id: string;
  step_key: string;
  step_type: string;
  status: string;
  decision_log_id: string | null;
  action_execution_id: string | null;
  input_json: Record<string, unknown>;
  output_json: Record<string, unknown>;
  started_at: string | null;
  completed_at: string | null;
};

export async function insertWorkflowRun(
  supabase: SupabaseClient,
  row: Omit<WorkflowRunRow, "id" | "created_at">
): Promise<{ data: WorkflowRunRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("workflow_runs")
    .insert(row)
    .select()
    .single();
  return { data: data as WorkflowRunRow | null, error: error as Error | null };
}

export async function getWorkflowRun(
  supabase: SupabaseClient,
  runId: string
): Promise<{ data: WorkflowRunRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("workflow_runs")
    .select("*")
    .eq("id", runId)
    .maybeSingle();
  return { data: data as WorkflowRunRow | null, error: error as Error | null };
}

export async function updateWorkflowRun(
  supabase: SupabaseClient,
  runId: string,
  updates: Partial<{ run_status: string; current_step_key: string | null; completed_at: string | null }>
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from("workflow_runs").update(updates).eq("id", runId);
  return { error: error as Error | null };
}

export async function listWorkflowRunsForOrg(
  supabase: SupabaseClient,
  orgId: string,
  params?: { status?: string; limit?: number }
): Promise<{ data: WorkflowRunRow[]; error: Error | null }> {
  let q = supabase
    .from("workflow_runs")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (params?.status) q = q.eq("run_status", params.status);
  const limit = Math.min(params?.limit ?? 50, 100);
  q = q.limit(limit);
  const { data, error } = await q;
  return { data: (data ?? []) as WorkflowRunRow[], error: error as Error | null };
}

export async function insertWorkflowStepRun(
  supabase: SupabaseClient,
  row: Omit<WorkflowStepRunRow, "id">
): Promise<{ data: WorkflowStepRunRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("workflow_step_runs")
    .insert(row)
    .select()
    .single();
  return { data: data as WorkflowStepRunRow | null, error: error as Error | null };
}

export async function listStepRunsForWorkflow(
  supabase: SupabaseClient,
  workflowRunId: string
): Promise<{ data: WorkflowStepRunRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("workflow_step_runs")
    .select("*")
    .eq("workflow_run_id", workflowRunId)
    .order("created_at", { ascending: true });
  return { data: (data ?? []) as WorkflowStepRunRow[], error: error as Error | null };
}
