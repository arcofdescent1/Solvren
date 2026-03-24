import type { SupabaseClient } from "@supabase/supabase-js";

export type GovernanceRuleSuggestionRow = {
  id: string;
  org_id: string;
  suggestion_type: string;
  target_policy_id: string | null;
  suggested_rule_json: Record<string, unknown>;
  evidence_summary_json: Record<string, unknown>;
  simulation_summary_json: Record<string, unknown>;
  status: string;
  generation_version: string | null;
  dataset_snapshot_id: string | null;
  created_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_rationale: string | null;
};

export async function getSuggestionById(
  supabase: SupabaseClient,
  id: string,
  orgId: string
): Promise<{ data: GovernanceRuleSuggestionRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("governance_rule_suggestions")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) return { data: null, error: error as Error };
  return { data: (data ?? null) as GovernanceRuleSuggestionRow | null, error: null };
}

export async function insertRuleSuggestion(
  supabase: SupabaseClient,
  input: {
    org_id: string;
    suggestion_type: string;
    target_policy_id?: string | null;
    suggested_rule_json: Record<string, unknown>;
    evidence_summary_json: Record<string, unknown>;
    simulation_summary_json: Record<string, unknown>;
    generation_version?: string | null;
    dataset_snapshot_id?: string | null;
  }
): Promise<{ data: GovernanceRuleSuggestionRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("governance_rule_suggestions")
    .insert({
      org_id: input.org_id,
      suggestion_type: input.suggestion_type,
      target_policy_id: input.target_policy_id ?? null,
      suggested_rule_json: input.suggested_rule_json,
      evidence_summary_json: input.evidence_summary_json,
      simulation_summary_json: input.simulation_summary_json,
      status: "DRAFT",
      generation_version: input.generation_version ?? null,
      dataset_snapshot_id: input.dataset_snapshot_id ?? null,
    })
    .select()
    .single();

  if (error) return { data: null, error: error as Error };
  return { data: data as GovernanceRuleSuggestionRow, error: null };
}

export async function updateSuggestionStatus(
  supabase: SupabaseClient,
  id: string,
  orgId: string,
  updates: {
    status: "REVIEWED" | "ACCEPTED" | "REJECTED";
    reviewed_by: string;
    review_rationale?: string | null;
  }
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("governance_rule_suggestions")
    .update({
      status: updates.status,
      reviewed_by: updates.reviewed_by,
      reviewed_at: new Date().toISOString(),
      review_rationale: updates.review_rationale ?? null,
    })
    .eq("id", id)
    .eq("org_id", orgId);

  return { error: error as Error | null };
}

export async function listSuggestionsForOrg(
  supabase: SupabaseClient,
  orgId: string,
  opts?: { status?: string; limit?: number }
): Promise<{ data: GovernanceRuleSuggestionRow[]; error: Error | null }> {
  let q = supabase
    .from("governance_rule_suggestions")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 50);
  if (opts?.status) q = q.eq("status", opts.status);
  const { data, error } = await q;
  if (error) return { data: [], error: error as Error };
  return { data: (data ?? []) as GovernanceRuleSuggestionRow[], error: null };
}
