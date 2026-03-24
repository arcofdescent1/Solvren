/**
 * Phase 6 — Labels joined to decision context (view-backed).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export async function listFeedbackFactsForOrg(
  supabase: SupabaseClient,
  orgId: string,
  opts?: { limit?: number }
): Promise<{ data: Record<string, unknown>[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("governance_feedback_facts")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 200);

  if (error) return { data: [], error: error as Error };
  return { data: (data ?? []) as Record<string, unknown>[], error: null };
}
