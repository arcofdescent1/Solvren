/**
 * Phase 6 — execution_tasks persistence (§14).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type ExecutionTaskRow = {
  id: string;
  issue_id: string;
  external_system: string;
  external_task_id: string | null;
  task_type: string;
  status: string;
  assignee_ref: string | null;
  due_at: string | null;
  sync_status: string | null;
  created_at: string;
  updated_at: string;
  idempotency_key?: string | null;
  writeback_status?: string | null;
  execution_mode?: string | null;
  retry_count?: number;
};

export async function findTaskByIdempotencyKey(
  supabase: SupabaseClient,
  idempotencyKey: string
): Promise<{ data: ExecutionTaskRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("execution_tasks")
    .select("*")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  return { data: data as ExecutionTaskRow | null, error: error as Error | null };
}

export async function insertExecutionTask(
  supabase: SupabaseClient,
  row: Omit<ExecutionTaskRow, "id" | "created_at" | "updated_at"> & Partial<Pick<ExecutionTaskRow, "idempotency_key" | "writeback_status" | "execution_mode" | "retry_count">>
): Promise<{ data: ExecutionTaskRow | null; error: Error | null }> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("execution_tasks")
    .insert({ ...row, updated_at: now })
    .select()
    .single();
  return { data: data as ExecutionTaskRow | null, error: error as Error | null };
}

export async function listExecutionTasksForIssue(
  supabase: SupabaseClient,
  issueId: string
): Promise<{ data: ExecutionTaskRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("execution_tasks")
    .select("*")
    .eq("issue_id", issueId)
    .order("created_at", { ascending: false });
  return { data: (data ?? []) as ExecutionTaskRow[], error: error as Error | null };
}

export async function listPendingTasksForOrg(
  supabase: SupabaseClient,
  orgId: string,
  limit = 50
): Promise<{
  data: Array<ExecutionTaskRow & { issue_title?: string; issue_key?: string }>;
  error: Error | null;
}> {
  const { data: orgIssues } = await supabase
    .from("issues")
    .select("id, title, issue_key")
    .eq("org_id", orgId);
  const issueIds = (orgIssues ?? []).map((i: { id: string }) => i.id);
  const issueMap = new Map((orgIssues ?? []).map((i: { id: string; title?: string; issue_key?: string }) => [i.id, { title: i.title, issue_key: i.issue_key }]));
  if (issueIds.length === 0) return { data: [], error: null };

  const { data: tasks, error } = await supabase
    .from("execution_tasks")
    .select("*")
    .in("issue_id", issueIds)
    .in("status", ["pending", "queued"])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return { data: [], error: error as Error };

  const rows = (tasks ?? []).map((t: ExecutionTaskRow) => {
    const meta = issueMap.get(t.issue_id);
    return { ...t, issue_title: meta?.title, issue_key: meta?.issue_key };
  });
  return { data: rows, error: null };
}

export async function updateExecutionTask(
  supabase: SupabaseClient,
  taskId: string,
  updates: Partial<Pick<ExecutionTaskRow, "external_task_id" | "status" | "assignee_ref" | "sync_status">>
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("execution_tasks")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", taskId);
  return { error: error as Error | null };
}
