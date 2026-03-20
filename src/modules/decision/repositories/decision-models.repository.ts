/**
 * Phase 5 — Decision models repository.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type DecisionModelRow = {
  id: string;
  model_key: string;
  display_name: string;
  description: string;
  issue_family: string | null;
  weights_json: Record<string, number>;
  normalization_rules_json: Record<string, unknown>;
  fallback_rules_json: Record<string, unknown>;
  tie_break_rules_json: unknown[];
  status: string;
  model_version: string;
  created_at: string;
  updated_at: string;
};

export async function getActiveDecisionModel(
  supabase: SupabaseClient,
  modelKey = "default_action_ranking",
  _issueFamily?: string | null
): Promise<{ data: DecisionModelRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("decision_models")
    .select("*")
    .eq("model_key", modelKey)
    .eq("status", "active")
    .order("model_version", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { data: data as DecisionModelRow | null, error: error as Error | null };
}
