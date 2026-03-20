/**
 * Phase 3 — raw_events repository (§9.1).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RawEventRow } from "../domain/types";

export async function insertRawEvent(
  supabase: SupabaseClient,
  row: Omit<RawEventRow, "id" | "created_at" | "updated_at">
): Promise<{ data: RawEventRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("raw_events")
    .insert({ ...row, updated_at: new Date().toISOString() })
    .select()
    .single();
  return { data: data as RawEventRow | null, error: error as Error | null };
}

export async function getRawEventById(
  supabase: SupabaseClient,
  id: string
): Promise<{ data: RawEventRow | null; error: Error | null }> {
  const { data, error } = await supabase.from("raw_events").select("*").eq("id", id).maybeSingle();
  return { data: data as RawEventRow | null, error: error as Error | null };
}

export async function getRawEventByIdempotency(
  supabase: SupabaseClient,
  orgId: string,
  provider: string,
  idempotencyKey: string
): Promise<{ data: RawEventRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("raw_events")
    .select("*")
    .eq("org_id", orgId)
    .eq("provider", provider)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  return { data: data as RawEventRow | null, error: error as Error | null };
}

export async function listRawEvents(
  supabase: SupabaseClient,
  params: {
    orgId: string;
    provider?: string;
    processingStatus?: string;
    limit?: number;
    offset?: number;
    fromReceived?: string;
    toReceived?: string;
  }
): Promise<{ data: RawEventRow[]; error: Error | null }> {
  let q = supabase.from("raw_events").select("*").eq("org_id", params.orgId);
  if (params.provider) q = q.eq("provider", params.provider);
  if (params.processingStatus) q = q.eq("processing_status", params.processingStatus);
  if (params.fromReceived) q = q.gte("received_at", params.fromReceived);
  if (params.toReceived) q = q.lte("received_at", params.toReceived);
  q = q.order("received_at", { ascending: false });
  const limit = Math.min(100, params.limit ?? 20);
  const offset = params.offset ?? 0;
  const { data, error } = await q.range(offset, offset + limit - 1);
  return { data: (data ?? []) as RawEventRow[], error: error as Error | null };
}

export async function updateRawEventProcessing(
  supabase: SupabaseClient,
  id: string,
  updates: {
    processing_status?: string;
    processing_attempts?: number;
    last_error_code?: string | null;
    last_error_message?: string | null;
    mapper_key?: string | null;
    mapper_version?: string | null;
  }
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("raw_events")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);
  return { error: error as Error | null };
}

export async function listPendingRawEvents(
  supabase: SupabaseClient,
  params: { limit?: number; orgId?: string }
): Promise<{ data: RawEventRow[]; error: Error | null }> {
  let q = supabase
    .from("raw_events")
    .select("*")
    .eq("processing_status", "pending")
    .order("received_at", { ascending: true });
  if (params.orgId) q = q.eq("org_id", params.orgId);
  const limit = Math.min(50, params.limit ?? 20);
  const { data, error } = await q.limit(limit);
  return { data: (data ?? []) as RawEventRow[], error: error as Error | null };
}
