/**
 * Phase 8 — Demo scenarios repository.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DemoScenario } from "../domain";

export type DemoScenarioRow = {
  id: string;
  scenario_key: string;
  display_name: string;
  description: string;
  status: string;
  seed_version: string;
  metadata_json: unknown;
  created_at: string;
  updated_at: string;
};

function rowToScenario(row: DemoScenarioRow): DemoScenario {
  return {
    id: row.id,
    scenarioKey: row.scenario_key,
    displayName: row.display_name,
    description: row.description,
    status: row.status,
    seedVersion: row.seed_version,
    metadataJson: (row.metadata_json ?? {}) as Record<string, unknown>,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listDemoScenarios(
  supabase: SupabaseClient,
  options?: { status?: string }
): Promise<{ data: DemoScenario[]; error: Error | null }> {
  let q = supabase
    .from("demo_scenarios")
    .select("id, scenario_key, display_name, description, status, seed_version, metadata_json, created_at, updated_at")
    .order("scenario_key");

  if (options?.status) {
    q = q.eq("status", options.status);
  }

  const { data, error } = await q;

  if (error) return { data: [], error: error as Error };
  const rows = (data ?? []) as DemoScenarioRow[];
  return { data: rows.map(rowToScenario), error: null };
}

export async function getDemoScenarioByKey(
  supabase: SupabaseClient,
  scenarioKey: string
): Promise<{ data: DemoScenario | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("demo_scenarios")
    .select("id, scenario_key, display_name, description, status, seed_version, metadata_json, created_at, updated_at")
    .eq("scenario_key", scenarioKey)
    .maybeSingle();

  if (error) return { data: null, error: error as Error };
  return { data: data ? rowToScenario(data as DemoScenarioRow) : null, error: null };
}
