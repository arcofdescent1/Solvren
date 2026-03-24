/**
 * Phase 3 — Approval requests repository.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type ApprovalRequestRow = {
  id: string;
  org_id: string;
  issue_id: string | null;
  finding_id: string | null;
  action_key: string | null;
  playbook_key: string | null;
  workflow_run_id: string | null;
  requested_roles_json: string[];
  required_approval_count: number;
  status: string;
  source_policy_decision_log_id: string;
  request_payload_json: Record<string, unknown>;
  created_by_type: string;
  created_by_user_id: string | null;
  created_at: string;
  resolved_at: string | null;
};

const DEFAULT_EXPIRY_HOURS = 72;

export async function insertApprovalRequest(
  supabase: SupabaseClient,
  input: {
    org_id: string;
    issue_id?: string | null;
    finding_id?: string | null;
    action_key?: string | null;
    playbook_key?: string | null;
    workflow_run_id?: string | null;
    requested_roles_json: string[];
    required_approval_count: number;
    source_policy_decision_log_id: string;
    request_payload_json?: Record<string, unknown>;
    created_by_type: string;
    created_by_user_id?: string | null;
  }
): Promise<{ data: ApprovalRequestRow | null; error: Error | null }> {
  const row = {
    org_id: input.org_id,
    issue_id: input.issue_id ?? null,
    finding_id: input.finding_id ?? null,
    action_key: input.action_key ?? null,
    playbook_key: input.playbook_key ?? null,
    workflow_run_id: input.workflow_run_id ?? null,
    requested_roles_json: input.requested_roles_json ?? [],
    required_approval_count: input.required_approval_count ?? 1,
    status: "pending",
    source_policy_decision_log_id: input.source_policy_decision_log_id,
    request_payload_json: input.request_payload_json ?? {},
    created_by_type: input.created_by_type,
    created_by_user_id: input.created_by_user_id ?? null,
  };
  const { data, error } = await supabase.from("approval_requests").insert(row).select().single();
  if (error) return { data: null, error: error as Error };
  return { data: data as ApprovalRequestRow, error: null };
}

export async function listPendingApprovals(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ data: ApprovalRequestRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("approval_requests")
    .select("*")
    .eq("org_id", orgId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  return { data: (data ?? []) as ApprovalRequestRow[], error: error as Error | null };
}

export async function getApprovalRequest(
  supabase: SupabaseClient,
  id: string
): Promise<{ data: ApprovalRequestRow | null; error: Error | null }> {
  const { data, error } = await supabase.from("approval_requests").select("*").eq("id", id).maybeSingle();
  return { data: data as ApprovalRequestRow | null, error: error as Error | null };
}

/** Loose match between approval_requests.action_key and governance action key (e.g. stripe.refund vs refund). */
export function approvalActionKeyMatchesPolicyAction(
  approvalActionKey: string | null,
  policyActionKey: string
): boolean {
  if (approvalActionKey == null || approvalActionKey === "") return true;
  if (approvalActionKey === policyActionKey) return true;
  if (policyActionKey.endsWith(`.${approvalActionKey}`)) return true;
  if (approvalActionKey.includes(".") && policyActionKey.endsWith(approvalActionKey)) return true;
  return false;
}

/**
 * After policy approval_requests is approved: stable join to the original policy_decision_logs row.
 */
export async function resolveGovernanceTraceFromApprovedPolicyRequest(
  supabase: SupabaseClient,
  params: {
    approvalRequestId: string;
    orgId: string;
    issueId: string;
    actionKeyForPolicy: string;
  }
): Promise<{ governanceTraceId: string } | { error: string }> {
  const { data: ar, error } = await getApprovalRequest(supabase, params.approvalRequestId);
  if (error || !ar) return { error: "Policy approval request not found" };
  if (ar.org_id !== params.orgId) return { error: "Policy approval request org mismatch" };
  if (ar.status !== "approved") {
    return { error: `Policy approval not approved (status=${ar.status})` };
  }
  if (ar.issue_id != null && ar.issue_id !== params.issueId) {
    return { error: "Policy approval request does not match this issue" };
  }
  if (!approvalActionKeyMatchesPolicyAction(ar.action_key, params.actionKeyForPolicy)) {
    return { error: "Policy approval request does not match this action" };
  }
  if (!ar.source_policy_decision_log_id) {
    return { error: "Missing governance trace on policy approval request" };
  }
  return { governanceTraceId: ar.source_policy_decision_log_id };
}

export async function resolveApprovalRequest(
  supabase: SupabaseClient,
  id: string,
  status: "approved" | "rejected" | "canceled",
  resolvedByUserId?: string | null
): Promise<{ data: ApprovalRequestRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("approval_requests")
    .update({ status, resolved_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending")
    .select()
    .single();
  if (error) return { data: null, error: error as Error };
  return { data: data as ApprovalRequestRow, error: null };
}

export { DEFAULT_EXPIRY_HOURS };
