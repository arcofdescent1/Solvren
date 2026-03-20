/**
 * Phase 3 — Policy decision logs repository (append-only audit).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type PolicyDecisionLogRow = {
  id: string;
  org_id: string;
  issue_id: string | null;
  finding_id: string | null;
  action_key: string | null;
  playbook_key: string | null;
  workflow_step_key: string | null;
  evaluation_context_json: Record<string, unknown>;
  matched_rules_json: unknown[];
  blocked_rules_json: unknown[];
  approval_rules_json: unknown[];
  final_disposition: string;
  decision_reason_code: string;
  decision_message: string;
  effective_autonomy_mode: string;
  required_approver_roles_json: string[];
  required_approval_count: number;
  applied_exception_ids_json: string[];
  created_at: string;
};

export type InsertDecisionLogInput = {
  org_id: string;
  issue_id?: string | null;
  finding_id?: string | null;
  action_key?: string | null;
  playbook_key?: string | null;
  workflow_step_key?: string | null;
  evaluation_context_json: Record<string, unknown>;
  matched_rules_json: unknown[];
  blocked_rules_json: unknown[];
  approval_rules_json: unknown[];
  final_disposition: string;
  decision_reason_code: string;
  decision_message: string;
  effective_autonomy_mode: string;
  required_approver_roles_json?: string[];
  required_approval_count?: number;
  applied_exception_ids_json?: string[];
};

export async function insertPolicyDecisionLog(
  supabase: SupabaseClient,
  input: InsertDecisionLogInput
): Promise<{ data: PolicyDecisionLogRow | null; error: Error | null }> {
  const row = {
    org_id: input.org_id,
    issue_id: input.issue_id ?? null,
    finding_id: input.finding_id ?? null,
    action_key: input.action_key ?? null,
    playbook_key: input.playbook_key ?? null,
    workflow_step_key: input.workflow_step_key ?? null,
    evaluation_context_json: input.evaluation_context_json,
    matched_rules_json: input.matched_rules_json ?? [],
    blocked_rules_json: input.blocked_rules_json ?? [],
    approval_rules_json: input.approval_rules_json ?? [],
    final_disposition: input.final_disposition,
    decision_reason_code: input.decision_reason_code,
    decision_message: input.decision_message,
    effective_autonomy_mode: input.effective_autonomy_mode,
    required_approver_roles_json: input.required_approver_roles_json ?? [],
    required_approval_count: input.required_approval_count ?? 0,
    applied_exception_ids_json: input.applied_exception_ids_json ?? [],
  };
  const { data, error } = await supabase.from("policy_decision_logs").insert(row).select().single();
  if (error) return { data: null, error: error as Error };
  return { data: data as PolicyDecisionLogRow, error: null };
}

export async function getDecisionLogById(
  supabase: SupabaseClient,
  id: string
): Promise<{ data: PolicyDecisionLogRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("policy_decision_logs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) return { data: null, error: error as Error };
  return { data: data as PolicyDecisionLogRow | null, error: null };
}

export async function listDecisionLogs(
  supabase: SupabaseClient,
  orgId: string,
  options?: { issueId?: string; limit?: number }
): Promise<{ data: PolicyDecisionLogRow[]; error: Error | null }> {
  let q = supabase
    .from("policy_decision_logs")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(options?.limit ?? 50);

  if (options?.issueId) q = q.eq("issue_id", options.issueId);

  const { data, error } = await q;
  return { data: (data ?? []) as PolicyDecisionLogRow[], error: error as Error | null };
}
