/**
 * Phase 3 — signal_definitions repository (§9.2).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SignalDefinitionRow } from "../domain/types";

export async function listSignalDefinitions(
  supabase: SupabaseClient,
  params?: { category?: string; enabled?: boolean }
): Promise<{ data: SignalDefinitionRow[]; error: Error | null }> {
  let q = supabase.from("signal_definitions").select("*");
  if (params?.category) q = q.eq("category", params.category);
  if (params?.enabled != null) q = q.eq("enabled", params.enabled);
  q = q.order("category").order("signal_key");
  const { data, error } = await q;
  return { data: (data ?? []) as SignalDefinitionRow[], error: error as Error | null };
}

export async function getSignalDefinitionByKey(
  supabase: SupabaseClient,
  signalKey: string
): Promise<{ data: SignalDefinitionRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("signal_definitions")
    .select("*")
    .eq("signal_key", signalKey)
    .maybeSingle();
  return { data: data as SignalDefinitionRow | null, error: error as Error | null };
}

export async function getSignalDefinitionById(
  supabase: SupabaseClient,
  id: string
): Promise<{ data: SignalDefinitionRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("signal_definitions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return { data: data as SignalDefinitionRow | null, error: error as Error | null };
}
