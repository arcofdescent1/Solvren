/**
 * Phase 5 — Decision logs repository.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type DecisionLogRow = {
  id: string;
  org_id: string;
  issue_id: string | null;
  finding_id: string | null;
  workflow_run_id: string | null;
  workflow_step_key: string | null;
  decision_model_id: string | null;
  decision_model_key: string | null;
  decision_model_version: string | null;
  context_json: Record<string, unknown>;
  candidate_actions_json: unknown[];
  blocked_actions_json: unknown[];
  ineligible_actions_json: unknown[];
  ranked_actions_json: unknown[];
  selected_action_key: string | null;
  used_cold_start: boolean;
  result_status: string;
  context_hash: string | null;
  created_at: string;
};

export async function insertDecisionLog(
  supabase: SupabaseClient,
  input: {
    org_id: string;
    issue_id?: string | null;
    finding_id?: string | null;
    workflow_run_id?: string | null;
    decision_model_id: string | null;
    decision_model_key: string;
    decision_model_version: string;
    context_json: Record<string, unknown>;
    candidate_actions_json: unknown[];
    blocked_actions_json: unknown[];
    ineligible_actions_json: unknown[];
    ranked_actions_json: unknown[];
    selected_action_key: string | null;
    used_cold_start: boolean;
    result_status: string;
    context_hash: string;
    selection_reason_json?: Record<string, unknown>;
    policy_constraints_json?: Record<string, unknown>;
    confidence_score?: number;
    requires_approval?: boolean;
  }
): Promise<{ data: DecisionLogRow | null; error: Error | null }> {
  const ctx = input.context_json ?? {};
  const ranked = input.ranked_actions_json ?? [];
  const selected = input.selected_action_key ?? null;
  const topRanked = Array.isArray(ranked) && ranked.length > 0 ? ranked[0] : null;
  const row = {
    org_id: input.org_id,
    issue_id: input.issue_id ?? null,
    finding_id: input.finding_id ?? null,
    workflow_run_id: input.workflow_run_id ?? null,
    decision_context_json: ctx,
    eligible_actions_json: ranked,
    blocked_actions_json: input.blocked_actions_json ?? [],
    ranked_actions_json: ranked,
    selected_action_key: selected,
    selection_reason_json: input.selection_reason_json ?? {
      selectedActionKey: selected,
      explanationText: (topRanked as Record<string, unknown> | null)?.explanationText ?? null,
    },
    policy_constraints_json: input.policy_constraints_json ?? {},
    confidence_score: input.confidence_score ?? 0,
    requires_approval: input.requires_approval ?? false,
    decision_status: input.result_status,
    decision_model_id: input.decision_model_id ?? null,
    decision_model_key: input.decision_model_key,
    decision_model_version: input.decision_model_version,
    candidate_actions_json: input.candidate_actions_json ?? [],
    ineligible_actions_json: input.ineligible_actions_json ?? [],
    used_cold_start: input.used_cold_start ?? false,
    result_status: input.result_status,
    context_hash: input.context_hash,
  };
  const { data, error } = await supabase
    .from("decision_logs")
    .insert(row as Record<string, unknown>)
    .select()
    .single();
  if (error) return { data: null, error: error as Error };
  return { data: data as DecisionLogRow, error: null };
}

export async function getDecisionLogByTraceId(
  supabase: SupabaseClient,
  traceId: string
): Promise<{ data: DecisionLogRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("decision_logs")
    .select("*")
    .eq("id", traceId)
    .maybeSingle();
  return { data: data as DecisionLogRow | null, error: error as Error | null };
}

export async function listDecisionLogs(
  supabase: SupabaseClient,
  orgId: string,
  filters?: { issueId?: string; limit?: number }
): Promise<{ data: DecisionLogRow[]; error: Error | null }> {
  let q = supabase
    .from("decision_logs")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(filters?.limit ?? 50);

  if (filters?.issueId) q = q.eq("issue_id", filters.issueId);

  const { data, error } = await q;
  return { data: (data ?? []) as DecisionLogRow[], error: error as Error | null };
}
