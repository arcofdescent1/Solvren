/**
 * Phase 2 — Simulation input snapshots repository.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type SnapshotType = "HISTORICAL_WINDOW" | "ISSUE_SET" | "DEMO_SEED";

export type SimulationInputSnapshotRow = {
  id: string;
  org_id: string;
  snapshot_type: string;
  historical_window_start: string | null;
  historical_window_end: string | null;
  issues_snapshot_json: unknown[];
  findings_snapshot_json: unknown[];
  signals_snapshot_json: unknown[];
  entities_snapshot_json: unknown[];
  actions_snapshot_json: unknown[];
  outcomes_snapshot_json: unknown[];
  source_metadata_json: Record<string, unknown>;
  created_at: string;
};

export type InsertSnapshotInput = {
  org_id: string;
  snapshot_type: SnapshotType;
  historical_window_start?: string | null;
  historical_window_end?: string | null;
  issues_snapshot_json?: unknown[];
  findings_snapshot_json?: unknown[];
  signals_snapshot_json?: unknown[];
  entities_snapshot_json?: unknown[];
  actions_snapshot_json?: unknown[];
  outcomes_snapshot_json?: unknown[];
  source_metadata_json?: Record<string, unknown>;
};

export async function insertInputSnapshot(
  supabase: SupabaseClient,
  input: InsertSnapshotInput
): Promise<{ data: SimulationInputSnapshotRow | null; error: Error | null }> {
  const row = {
    org_id: input.org_id,
    snapshot_type: input.snapshot_type,
    historical_window_start: input.historical_window_start ?? null,
    historical_window_end: input.historical_window_end ?? null,
    issues_snapshot_json: input.issues_snapshot_json ?? [],
    findings_snapshot_json: input.findings_snapshot_json ?? [],
    signals_snapshot_json: input.signals_snapshot_json ?? [],
    entities_snapshot_json: input.entities_snapshot_json ?? [],
    actions_snapshot_json: input.actions_snapshot_json ?? [],
    outcomes_snapshot_json: input.outcomes_snapshot_json ?? [],
    source_metadata_json: input.source_metadata_json ?? {},
  };
  const { data, error } = await supabase
    .from("simulation_input_snapshots")
    .insert(row)
    .select()
    .single();
  if (error) return { data: null, error: error as unknown as Error };
  return { data: data as SimulationInputSnapshotRow, error: null };
}

export async function getInputSnapshot(
  supabase: SupabaseClient,
  snapshotId: string
): Promise<{ data: SimulationInputSnapshotRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("simulation_input_snapshots")
    .select("*")
    .eq("id", snapshotId)
    .single();
  if (error) return { data: null, error: error as unknown as Error };
  return { data: data as SimulationInputSnapshotRow, error: null };
}
