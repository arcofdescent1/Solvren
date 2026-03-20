/**
 * Phase 4 — detector_packs repository.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type DetectorPackRow = {
  id: string;
  pack_key: string;
  display_name: string;
  description: string;
  business_theme: string;
  recommended_integrations_json: string[];
  status: string;
  created_at: string;
};

export async function listDetectorPacks(
  supabase: SupabaseClient,
  status?: string
): Promise<{ data: DetectorPackRow[]; error: Error | null }> {
  let q = supabase.from("detector_packs").select("*").order("pack_key");
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  return { data: (data ?? []) as DetectorPackRow[], error: error as Error | null };
}

export async function getDetectorPackByKey(
  supabase: SupabaseClient,
  packKey: string
): Promise<{ data: DetectorPackRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("detector_packs")
    .select("*")
    .eq("pack_key", packKey)
    .maybeSingle();
  return { data: data as DetectorPackRow | null, error: error as Error | null };
}
