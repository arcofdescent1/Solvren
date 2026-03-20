/**
 * Phase 2 — Simulation entity results repository.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type SimulationEntityResultRow = {
  id: string;
  simulation_run_id: string;
  issue_id: string | null;
  finding_id: string | null;
  primary_entity_id: string | null;
  projected_recovered_amount: number | null;
  projected_avoided_amount: number | null;
  projected_operational_savings_amount: number | null;
  action_count: number;
  approval_count: number;
  blocked_action_count: number;
  confidence_score: number;
  confidence_band: string;
  explanation_json: Record<string, unknown>;
  created_at: string;
};

export async function insertEntityResult(
  supabase: SupabaseClient,
  input: {
    simulation_run_id: string;
    issue_id?: string | null;
    finding_id?: string | null;
    primary_entity_id?: string | null;
    projected_recovered_amount?: number | null;
    projected_avoided_amount?: number | null;
    projected_operational_savings_amount?: number | null;
    action_count?: number;
    approval_count?: number;
    blocked_action_count?: number;
    confidence_score: number;
    confidence_band: string;
    explanation_json?: Record<string, unknown>;
  }
): Promise<{ data: SimulationEntityResultRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("simulation_entity_results")
    .insert({
      simulation_run_id: input.simulation_run_id,
      issue_id: input.issue_id ?? null,
      finding_id: input.finding_id ?? null,
      primary_entity_id: input.primary_entity_id ?? null,
      projected_recovered_amount: input.projected_recovered_amount ?? null,
      projected_avoided_amount: input.projected_avoided_amount ?? null,
      projected_operational_savings_amount: input.projected_operational_savings_amount ?? null,
      action_count: input.action_count ?? 0,
      approval_count: input.approval_count ?? 0,
      blocked_action_count: input.blocked_action_count ?? 0,
      confidence_score: input.confidence_score,
      confidence_band: input.confidence_band,
      explanation_json: input.explanation_json ?? {},
    })
    .select()
    .single();
  if (error) return { data: null, error: error as unknown as Error };
  return { data: data as SimulationEntityResultRow, error: null };
}

export async function listEntityResults(
  supabase: SupabaseClient,
  runId: string
): Promise<{ data: SimulationEntityResultRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("simulation_entity_results")
    .select("*")
    .eq("simulation_run_id", runId);
  if (error) return { data: [], error: error as unknown as Error };
  return { data: (data ?? []) as SimulationEntityResultRow[], error: null };
}
