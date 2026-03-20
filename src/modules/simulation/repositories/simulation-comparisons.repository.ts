/**
 * Phase 2 — Simulation comparisons repository.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type SimulationComparisonRow = {
  id: string;
  org_id: string;
  baseline_run_id: string;
  candidate_run_id: string;
  comparison_type: string;
  comparison_result_json: Record<string, unknown>;
  created_at: string;
};

export async function insertComparison(
  supabase: SupabaseClient,
  input: {
    org_id: string;
    baseline_run_id: string;
    candidate_run_id: string;
    comparison_type: string;
    comparison_result_json: Record<string, unknown>;
  }
): Promise<{ data: SimulationComparisonRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("simulation_comparisons")
    .insert(input)
    .select()
    .single();
  if (error) return { data: null, error: error as unknown as Error };
  return { data: data as SimulationComparisonRow, error: null };
}

export async function getComparison(
  supabase: SupabaseClient,
  comparisonId: string
): Promise<{ data: SimulationComparisonRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("simulation_comparisons")
    .select("*")
    .eq("id", comparisonId)
    .single();
  if (error) return { data: null, error: error as unknown as Error };
  return { data: data as SimulationComparisonRow, error: null };
}
