/**
 * Phase 5 — impact_models repository.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ImpactModelRow } from "../domain/impact-model";

export async function getImpactModelByKey(
  supabase: SupabaseClient,
  modelKey: string,
  version?: string
): Promise<{ data: ImpactModelRow | null; error: Error | null }> {
  let q = supabase.from("impact_models").select("*").eq("model_key", modelKey).eq("status", "active");
  if (version) q = q.eq("model_version", version);
  q = q.order("model_version", { ascending: false }).limit(1);
  const { data, error } = await q.maybeSingle();
  return { data: data as ImpactModelRow | null, error: error as Error | null };
}

export async function getImpactModelForDetector(
  supabase: SupabaseClient,
  detectorKey: string
): Promise<{ data: ImpactModelRow | null; error: Error | null }> {
  const { data: models, error } = await supabase
    .from("impact_models")
    .select("*")
    .eq("status", "active")
    .contains("detector_keys_json", [detectorKey])
    .order("model_version", { ascending: false })
    .limit(1);
  if (error) return { data: null, error: error as Error };
  const first = (models ?? [])[0];
  return { data: first as ImpactModelRow | null, error: null };
}

export async function listImpactModels(
  supabase: SupabaseClient,
  params?: { issueFamily?: string }
): Promise<{ data: ImpactModelRow[]; error: Error | null }> {
  let q = supabase.from("impact_models").select("*").eq("status", "active").order("model_key");
  if (params?.issueFamily) q = q.eq("issue_family", params.issueFamily);
  const { data, error } = await q;
  return { data: (data ?? []) as ImpactModelRow[], error: error as Error | null };
}
