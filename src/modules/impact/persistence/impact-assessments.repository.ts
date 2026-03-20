/**
 * Phase 5 — impact_quantifications repository.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ImpactAssessmentRow } from "../domain/impact-assessment";

export async function insertImpactAssessment(
  supabase: SupabaseClient,
  row: Omit<ImpactAssessmentRow, "id" | "created_at">
): Promise<{ data: ImpactAssessmentRow | null; error: Error | null }> {
  const { data, error } = await supabase.from("impact_quantifications").insert(row).select().single();
  return { data: data as ImpactAssessmentRow | null, error: error as Error | null };
}

export async function getLatestAssessmentForIssue(
  supabase: SupabaseClient,
  orgId: string,
  issueId: string
): Promise<{ data: ImpactAssessmentRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("impact_quantifications")
    .select("*")
    .eq("org_id", orgId)
    .eq("issue_id", issueId)
    .is("superseded_by_assessment_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { data: data as ImpactAssessmentRow | null, error: error as Error | null };
}
