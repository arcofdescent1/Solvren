/**
 * Phase 8 — Demo seed manifests repository.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DemoSeedManifest, DemoManifestContent } from "../domain";

export type DemoSeedManifestRow = {
  id: string;
  scenario_key: string;
  seed_version: string;
  manifest_json: unknown;
  created_at: string;
};

function rowToManifest(row: DemoSeedManifestRow): DemoSeedManifest {
  return {
    id: row.id,
    scenarioKey: row.scenario_key,
    seedVersion: row.seed_version,
    manifestJson: (row.manifest_json ?? {}) as DemoManifestContent,
    createdAt: row.created_at,
  };
}

export async function getDemoSeedManifest(
  supabase: SupabaseClient,
  scenarioKey: string,
  seedVersion: string
): Promise<{ data: DemoSeedManifest | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("demo_seed_manifests")
    .select("id, scenario_key, seed_version, manifest_json, created_at")
    .eq("scenario_key", scenarioKey)
    .eq("seed_version", seedVersion)
    .maybeSingle();

  if (error) return { data: null, error: error as Error };
  return { data: data ? rowToManifest(data as DemoSeedManifestRow) : null, error: null };
}
