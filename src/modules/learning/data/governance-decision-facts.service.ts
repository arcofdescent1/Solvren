/**
 * Phase 6 — Canonical decision facts (view-backed + helpers).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type GovernanceDecisionFact = {
  trace_id: string;
  org_id: string;
  decision_timestamp: string;
  resource_type: string | null;
  resource_id: string | null;
  action_key: string | null;
  disposition: string;
  approval_required: boolean;
  impact_amount: number | null;
  confidence: number | null;
};

export async function listDecisionFactsForOrg(
  supabase: SupabaseClient,
  orgId: string,
  opts?: { limit?: number; since?: string }
): Promise<{ data: GovernanceDecisionFact[]; error: Error | null }> {
  let q = supabase
    .from("governance_decision_facts")
    .select("*")
    .eq("org_id", orgId)
    .order("decision_timestamp", { ascending: false })
    .limit(opts?.limit ?? 500);

  if (opts?.since) {
    q = q.gte("decision_timestamp", opts.since);
  }

  const { data, error } = await q;
  if (error) return { data: [], error: error as Error };
  return { data: (data ?? []) as GovernanceDecisionFact[], error: null };
}
