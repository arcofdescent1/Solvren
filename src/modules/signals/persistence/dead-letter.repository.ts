/**
 * Phase 3 — dead_letter_events repository (§9.6).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type DeadLetterRow = {
  id: string;
  org_id: string;
  raw_event_id: string;
  failure_code: string;
  failure_message: string | null;
  retry_count: number;
  last_retry_at: string | null;
  status: string;
  resolution: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
};

export async function insertDeadLetterEvent(
  supabase: SupabaseClient,
  row: Omit<DeadLetterRow, "id" | "created_at" | "updated_at">
): Promise<{ data: DeadLetterRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("dead_letter_events")
    .insert({ ...row, updated_at: new Date().toISOString() })
    .select()
    .single();
  return { data: data as DeadLetterRow | null, error: error as Error | null };
}

export async function getDeadLetterById(
  supabase: SupabaseClient,
  id: string
): Promise<{ data: DeadLetterRow | null; error: Error | null }> {
  const { data, error } = await supabase.from("dead_letter_events").select("*").eq("id", id).maybeSingle();
  return { data: data as DeadLetterRow | null, error: error as Error | null };
}

export async function listDeadLetterEvents(
  supabase: SupabaseClient,
  params: { orgId: string; status?: string; limit?: number; offset?: number }
): Promise<{ data: DeadLetterRow[]; error: Error | null }> {
  let q = supabase.from("dead_letter_events").select("*").eq("org_id", params.orgId);
  if (params.status) q = q.eq("status", params.status);
  q = q.order("created_at", { ascending: false });
  const limit = Math.min(50, params.limit ?? 20);
  const offset = params.offset ?? 0;
  const { data, error } = await q.range(offset, offset + limit - 1);
  return { data: (data ?? []) as DeadLetterRow[], error: error as Error | null };
}

export async function updateDeadLetterEvent(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<Pick<DeadLetterRow, "status" | "resolution" | "resolved_at" | "resolved_by" | "retry_count" | "last_retry_at">>
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("dead_letter_events")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);
  return { error: error as Error | null };
}
