/**
 * Phase 4 — detector_definitions repository.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DetectorDefinitionRow } from "../domain/detector-definition";

export async function getDetectorDefinitionByKey(
  supabase: SupabaseClient,
  detectorKey: string
): Promise<{ data: DetectorDefinitionRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("detector_definitions")
    .select("*")
    .eq("detector_key", detectorKey)
    .maybeSingle();
  return { data: data as DetectorDefinitionRow | null, error: error as Error | null };
}

export async function getDetectorDefinitionById(
  supabase: SupabaseClient,
  id: string
): Promise<{ data: DetectorDefinitionRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("detector_definitions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return { data: data as DetectorDefinitionRow | null, error: error as Error | null };
}

export async function listDetectorDefinitions(
  supabase: SupabaseClient,
  params?: { packId?: string; status?: string }
): Promise<{ data: DetectorDefinitionRow[]; error: Error | null }> {
  let q = supabase.from("detector_definitions").select("*").order("detector_key");
  if (params?.packId) q = q.eq("detector_pack_id", params.packId);
  if (params?.status) q = q.eq("status", params.status);
  const { data, error } = await q;
  return { data: (data ?? []) as DetectorDefinitionRow[], error: error as Error | null };
}
