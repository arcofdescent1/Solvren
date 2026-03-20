/**
 * Phase 2 — Simulation step results repository.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type StepStatus = "SKIPPED" | "COMPLETED" | "BLOCKED" | "SIMULATED" | "FAILED";

export type SimulationStepResultRow = {
  id: string;
  simulation_run_id: string;
  sequence_no: number;
  issue_id: string | null;
  finding_id: string | null;
  workflow_key: string | null;
  step_key: string;
  step_type: string;
  step_status: string;
  input_json: Record<string, unknown>;
  output_json: Record<string, unknown>;
  explanation_json: Record<string, unknown>;
  created_at: string;
};

export async function insertStepResult(
  supabase: SupabaseClient,
  input: {
    simulation_run_id: string;
    sequence_no: number;
    issue_id?: string | null;
    finding_id?: string | null;
    workflow_key?: string | null;
    step_key: string;
    step_type: string;
    step_status: StepStatus;
    input_json?: Record<string, unknown>;
    output_json?: Record<string, unknown>;
    explanation_json?: Record<string, unknown>;
  }
): Promise<{ data: SimulationStepResultRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("simulation_step_results")
    .insert({
      simulation_run_id: input.simulation_run_id,
      sequence_no: input.sequence_no,
      issue_id: input.issue_id ?? null,
      finding_id: input.finding_id ?? null,
      workflow_key: input.workflow_key ?? null,
      step_key: input.step_key,
      step_type: input.step_type,
      step_status: input.step_status,
      input_json: input.input_json ?? {},
      output_json: input.output_json ?? {},
      explanation_json: input.explanation_json ?? {},
    })
    .select()
    .single();
  if (error) return { data: null, error: error as unknown as Error };
  return { data: data as SimulationStepResultRow, error: null };
}

export async function listStepResults(
  supabase: SupabaseClient,
  runId: string
): Promise<{ data: SimulationStepResultRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("simulation_step_results")
    .select("*")
    .eq("simulation_run_id", runId)
    .order("sequence_no", { ascending: true });
  if (error) return { data: [], error: error as unknown as Error };
  return { data: (data ?? []) as SimulationStepResultRow[], error: null };
}
