/**
 * Phase 4 — detector_configs repository.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DetectorConfigRow } from "../domain/detector-config";

export async function getDetectorConfig(
  supabase: SupabaseClient,
  orgId: string,
  detectorDefinitionId: string
): Promise<{ data: DetectorConfigRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("detector_configs")
    .select("*")
    .eq("org_id", orgId)
    .eq("detector_definition_id", detectorDefinitionId)
    .maybeSingle();
  return { data: data as DetectorConfigRow | null, error: error as Error | null };
}

export async function upsertDetectorConfig(
  supabase: SupabaseClient,
  input: Omit<DetectorConfigRow, "id" | "created_at" | "updated_at">
): Promise<{ data: DetectorConfigRow | null; error: Error | null }> {
  const row = {
    ...input,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("detector_configs")
    .upsert(row, { onConflict: "org_id,detector_definition_id" })
    .select()
    .single();
  return { data: data as DetectorConfigRow | null, error: error as Error | null };
}

export async function listEnabledDetectorConfigs(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ data: DetectorConfigRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("detector_configs")
    .select("*")
    .eq("org_id", orgId)
    .eq("enabled", true);
  return { data: (data ?? []) as DetectorConfigRow[], error: error as Error | null };
}
