/**
 * Phase 3 — normalized_signals repository (§9.3).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedSignalRow } from "../domain/types";

export async function insertNormalizedSignal(
  supabase: SupabaseClient,
  row: Omit<NormalizedSignalRow, "id" | "created_at">
): Promise<{ data: NormalizedSignalRow | null; error: Error | null }> {
  const { data, error } = await supabase.from("normalized_signals").insert(row).select().single();
  return { data: data as NormalizedSignalRow | null, error: error as Error | null };
}

export async function getNormalizedSignalById(
  supabase: SupabaseClient,
  id: string
): Promise<{ data: NormalizedSignalRow | null; error: Error | null }> {
  const { data, error } = await supabase.from("normalized_signals").select("*").eq("id", id).maybeSingle();
  return { data: data as NormalizedSignalRow | null, error: error as Error | null };
}

export async function getNormalizedSignalByIdempotency(
  supabase: SupabaseClient,
  orgId: string,
  idempotencyKey: string
): Promise<{ data: NormalizedSignalRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("normalized_signals")
    .select("*")
    .eq("org_id", orgId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  return { data: data as NormalizedSignalRow | null, error: error as Error | null };
}

export async function listNormalizedSignals(
  supabase: SupabaseClient,
  params: {
    orgId: string;
    signalKey?: string;
    provider?: string;
    primaryEntityId?: string;
    fromTime?: string;
    toTime?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ data: NormalizedSignalRow[]; error: Error | null }> {
  let q = supabase.from("normalized_signals").select("*").eq("org_id", params.orgId);
  if (params.signalKey) q = q.eq("signal_key", params.signalKey);
  if (params.provider) q = q.eq("provider", params.provider);
  if (params.primaryEntityId) q = q.eq("primary_canonical_entity_id", params.primaryEntityId);
  if (params.fromTime) q = q.gte("signal_time", params.fromTime);
  if (params.toTime) q = q.lte("signal_time", params.toTime);
  q = q.order("signal_time", { ascending: false });
  const limit = Math.min(100, params.limit ?? 20);
  const offset = params.offset ?? 0;
  const { data, error } = await q.range(offset, offset + limit - 1);
  return { data: (data ?? []) as NormalizedSignalRow[], error: error as Error | null };
}
