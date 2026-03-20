/**
 * Phase 7 — Timeline event corrections repository.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export async function insertCorrection(
  supabase: SupabaseClient,
  input: {
    org_id: string;
    original_event_id: string;
    correction_event_id: string;
    reason: string;
  }
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("timeline_event_corrections")
    .insert(input as Record<string, unknown>);
  return { error: error as Error | null };
}

export async function getCorrectionsByOriginal(
  supabase: SupabaseClient,
  originalEventId: string
): Promise<{ data: { correction_event_id: string; reason: string }[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("timeline_event_corrections")
    .select("correction_event_id, reason")
    .eq("original_event_id", originalEventId);
  const rows = (data ?? []) as { correction_event_id: string; reason: string }[];
  return { data: rows, error: error as Error | null };
}
