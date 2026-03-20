/**
 * Phase 2 — Simulation runs repository.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { SimulationStatus } from "../domain";

export type SimulationRunRow = {
  id: string;
  org_id: string;
  simulation_type: string;
  status: string;
  historical_window_start: string;
  historical_window_end: string;
  scope_json: Record<string, unknown>;
  config_json: Record<string, unknown>;
  input_snapshot_id: string | null;
  policy_snapshot_json: Record<string, unknown>;
  playbook_snapshot_json: Record<string, unknown>;
  assumption_snapshot_json: Record<string, unknown>;
  engine_snapshot_json: Record<string, unknown>;
  deterministic_seed: string;
  result_summary_json: Record<string, unknown> | null;
  confidence_summary_json: Record<string, unknown> | null;
  warning_summary_json: unknown[] | null;
  created_by_user_id: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

export type InsertSimulationRunInput = {
  org_id: string;
  simulation_type: string;
  historical_window_start: string;
  historical_window_end: string;
  scope_json?: Record<string, unknown>;
  config_json?: Record<string, unknown>;
  input_snapshot_id: string;
  policy_snapshot_json: Record<string, unknown>;
  playbook_snapshot_json: Record<string, unknown>;
  assumption_snapshot_json?: Record<string, unknown>;
  engine_snapshot_json: Record<string, unknown>;
  deterministic_seed: string;
  created_by_user_id?: string | null;
};

export async function insertSimulationRun(
  supabase: SupabaseClient,
  input: InsertSimulationRunInput
): Promise<{ data: SimulationRunRow | null; error: Error | null }> {
  const row = {
    org_id: input.org_id,
    simulation_type: input.simulation_type,
    status: SimulationStatus.QUEUED,
    historical_window_start: input.historical_window_start,
    historical_window_end: input.historical_window_end,
    scope_json: input.scope_json ?? {},
    config_json: input.config_json ?? {},
    input_snapshot_id: input.input_snapshot_id,
    policy_snapshot_json: input.policy_snapshot_json,
    playbook_snapshot_json: input.playbook_snapshot_json,
    assumption_snapshot_json: input.assumption_snapshot_json ?? {},
    engine_snapshot_json: input.engine_snapshot_json,
    deterministic_seed: input.deterministic_seed,
    created_by_user_id: input.created_by_user_id ?? null,
  };
  const { data, error } = await supabase
    .from("simulation_runs")
    .insert(row)
    .select()
    .single();
  if (error) return { data: null, error: error as unknown as Error };
  return { data: data as SimulationRunRow, error: null };
}

export async function getSimulationRun(
  supabase: SupabaseClient,
  runId: string
): Promise<{ data: SimulationRunRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("simulation_runs")
    .select("*")
    .eq("id", runId)
    .single();
  if (error) return { data: null, error: error as unknown as Error };
  return { data: data as SimulationRunRow, error: null };
}

export async function listSimulationRuns(
  supabase: SupabaseClient,
  orgId: string,
  options?: { limit?: number; status?: string }
): Promise<{ data: SimulationRunRow[]; error: Error | null }> {
  let q = supabase
    .from("simulation_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(options?.limit ?? 20);
  if (orgId) q = q.eq("org_id", orgId);
  if (options?.status) q = q.eq("status", options.status);
  const { data, error } = await q;
  if (error) return { data: [], error: error as unknown as Error };
  return { data: (data ?? []) as SimulationRunRow[], error: null };
}

export async function listQueuedRunsAcrossOrgs(
  supabase: SupabaseClient,
  limit = 5
): Promise<{ data: SimulationRunRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("simulation_runs")
    .select("*")
    .eq("status", SimulationStatus.QUEUED)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) return { data: [], error: error as unknown as Error };
  return { data: (data ?? []) as SimulationRunRow[], error: null };
}

export async function updateSimulationRunStatus(
  supabase: SupabaseClient,
  runId: string,
  status: string,
  updates?: {
    started_at?: string;
    completed_at?: string;
    result_summary_json?: Record<string, unknown>;
    confidence_summary_json?: Record<string, unknown>;
    warning_summary_json?: unknown[];
  }
): Promise<{ error: Error | null }> {
  const payload: Record<string, unknown> = { status, ...updates };
  const { error } = await supabase
    .from("simulation_runs")
    .update(payload)
    .eq("id", runId);
  return { error: error as unknown as Error | null };
}
