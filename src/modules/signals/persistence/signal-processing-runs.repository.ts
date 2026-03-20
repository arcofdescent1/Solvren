/**
 * Phase 3 — signal_processing_runs repository (§9.5).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type SignalProcessingRunRow = {
  id: string;
  org_id: string;
  run_type: string;
  trigger_source: string;
  status: string;
  raw_events_processed: number;
  signals_produced: number;
  errors_count: number;
  dead_letter_count: number;
  started_at: string;
  completed_at: string | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
};

export async function insertProcessingRun(
  supabase: SupabaseClient,
  row: Omit<SignalProcessingRunRow, "id" | "created_at">
): Promise<{ data: SignalProcessingRunRow | null; error: Error | null }> {
  const { data, error } = await supabase.from("signal_processing_runs").insert(row).select().single();
  return { data: data as SignalProcessingRunRow | null, error: error as Error | null };
}

export async function updateProcessingRun(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<Pick<SignalProcessingRunRow, "status" | "raw_events_processed" | "signals_produced" | "errors_count" | "dead_letter_count" | "completed_at">>
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from("signal_processing_runs").update(updates).eq("id", id);
  return { error: error as Error | null };
}
