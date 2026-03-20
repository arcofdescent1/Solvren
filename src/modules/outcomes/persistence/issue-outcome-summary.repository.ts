/**
 * Phase 7 — issue_outcome_summary persistence.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { IssueOutcomeSummaryRow } from "../domain";

export async function upsertIssueOutcomeSummary(
  supabase: SupabaseClient,
  row: IssueOutcomeSummaryRow
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("issue_outcome_summary")
    .upsert(
      {
        ...row,
        last_updated: new Date().toISOString(),
      },
      { onConflict: "issue_id" }
    );
  return { error: error as Error | null };
}

export async function getIssueOutcomeSummary(
  supabase: SupabaseClient,
  issueId: string
): Promise<{ data: IssueOutcomeSummaryRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("issue_outcome_summary")
    .select("*")
    .eq("issue_id", issueId)
    .maybeSingle();
  return { data: data as IssueOutcomeSummaryRow | null, error: error as Error | null };
}

export async function recomputeIssueOutcomeSummary(
  supabase: SupabaseClient,
  issueId: string,
  orgId: string
): Promise<{ error: Error | null }> {
  const { data: outcomes } = await supabase
    .from("outcomes")
    .select("outcome_type, amount")
    .eq("issue_id", issueId);

  let total_recovered = 0;
  let total_avoided = 0;
  let total_cost_savings = 0;

  for (const o of outcomes ?? []) {
    const amt = Number((o as { amount: number }).amount) || 0;
    switch ((o as { outcome_type: string }).outcome_type) {
      case "recovered_revenue":
        total_recovered += amt;
        break;
      case "avoided_loss":
        total_avoided += amt;
        break;
      case "operational_savings":
        total_cost_savings += amt;
        break;
    }
  }

  const { error } = await supabase
    .from("issue_outcome_summary")
    .upsert(
      {
        issue_id: issueId,
        org_id: orgId,
        total_recovered,
        total_avoided,
        total_cost_savings,
        outcome_count: (outcomes ?? []).length,
        last_updated: new Date().toISOString(),
      },
      { onConflict: "issue_id" }
    );
  return { error: error as Error | null };
}
