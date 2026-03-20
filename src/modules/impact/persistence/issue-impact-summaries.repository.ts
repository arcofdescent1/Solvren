/**
 * Phase 5 — issue_impact_summaries repository.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { IssueImpactSummaryRow } from "../domain/impact-summary";

export async function upsertIssueImpactSummary(
  supabase: SupabaseClient,
  row: IssueImpactSummaryRow
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("issue_impact_summaries")
    .upsert(row, { onConflict: "issue_id" });
  return { error: error as Error | null };
}

export async function getIssueImpactSummary(
  supabase: SupabaseClient,
  issueId: string
): Promise<{ data: IssueImpactSummaryRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("issue_impact_summaries")
    .select("*")
    .eq("issue_id", issueId)
    .maybeSingle();
  return { data: data as IssueImpactSummaryRow | null, error: error as Error | null };
}

/** Phase 5 — List summaries for reporting (§18.4). */
export async function listIssueImpactSummariesForOrg(
  supabase: SupabaseClient,
  orgId: string,
  params?: { issueIds?: string[]; limit?: number }
): Promise<{ data: IssueImpactSummaryRow[]; error: Error | null }> {
  let q = supabase.from("issue_impact_summaries").select("*").eq("org_id", orgId);
  if (params?.issueIds?.length) q = q.in("issue_id", params.issueIds);
  const limit = Math.min(params?.limit ?? 500, 1000);
  q = q.limit(limit);
  const { data, error } = await q;
  return { data: (data ?? []) as IssueImpactSummaryRow[], error: error as Error | null };
}
