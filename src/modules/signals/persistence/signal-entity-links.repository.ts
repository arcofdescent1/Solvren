/**
 * Phase 3 — signal_entity_links repository (§9.4).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type SignalEntityLinkRow = {
  id: string;
  org_id: string;
  normalized_signal_id: string;
  canonical_entity_id: string;
  link_role: string;
  confidence_score: number;
  created_at: string;
};

export async function insertSignalEntityLink(
  supabase: SupabaseClient,
  row: Omit<SignalEntityLinkRow, "id" | "created_at">
): Promise<{ data: SignalEntityLinkRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("signal_entity_links")
    .insert(row)
    .select()
    .single();
  return { data: data as SignalEntityLinkRow | null, error: error as Error | null };
}

export async function getSignalEntityLinksBySignalId(
  supabase: SupabaseClient,
  normalizedSignalId: string
): Promise<{ data: SignalEntityLinkRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("signal_entity_links")
    .select("*")
    .eq("normalized_signal_id", normalizedSignalId);
  return { data: (data ?? []) as SignalEntityLinkRow[], error: error as Error | null };
}
