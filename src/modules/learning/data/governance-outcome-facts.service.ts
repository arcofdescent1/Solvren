/**
 * Phase 6 — Approval / execution outcome projections for learning joins.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export async function listApprovalOutcomesForOrg(
  supabase: SupabaseClient,
  orgId: string,
  opts?: { limit?: number }
): Promise<{ data: Record<string, unknown>[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("governance_approval_outcome_facts")
    .select("*")
    .eq("org_id", orgId)
    .order("approval_requested_at", { ascending: false })
    .limit(opts?.limit ?? 200);

  if (error) return { data: [], error: error as Error };
  return { data: (data ?? []) as Record<string, unknown>[], error: null };
}
