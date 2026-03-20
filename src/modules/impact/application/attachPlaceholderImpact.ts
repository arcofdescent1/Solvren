/**
 * Phase 0 — Attach a placeholder impact assessment to an issue.
 * Inserts one row into issue_impact_assessments for stub/onboarding flows.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

const PLACEHOLDER_MODEL_KEY = "placeholder";

export type AttachPlaceholderImpactResult = { error?: string };

export async function attachPlaceholderImpact(
  supabase: SupabaseClient,
  issueId: string
): Promise<AttachPlaceholderImpactResult> {
  const { error } = await supabase.from("issue_impact_assessments").insert({
    issue_id: issueId,
    model_key: PLACEHOLDER_MODEL_KEY,
    model_version: null,
    direct_revenue_loss: null,
    revenue_at_risk: null,
    customer_count_affected: null,
    operational_cost_estimate: null,
    confidence_score: null,
    assumptions_json: {},
  });

  if (error) return { error: error.message };
  return {};
}
