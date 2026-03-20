/**
 * Phase 4 — detector_runs repository.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type DetectorRunRow = {
  id: string;
  org_id: string;
  detector_definition_id: string;
  run_mode: string;
  trigger_signal_id: string | null;
  window_start: string | null;
  window_end: string | null;
  status: string;
  candidate_count: number;
  detection_count: number;
  suppressed_count: number;
  error_count: number;
  metrics_json: Record<string, unknown>;
  started_at: string;
  completed_at: string | null;
};

export async function insertDetectorRun(
  supabase: SupabaseClient,
  input: Omit<DetectorRunRow, "id">
): Promise<{ data: DetectorRunRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("detector_runs")
    .insert(input)
    .select()
    .single();
  return { data: data as DetectorRunRow | null, error: error as Error | null };
}

export async function updateDetectorRun(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<Pick<DetectorRunRow, "status" | "candidate_count" | "detection_count" | "suppressed_count" | "error_count" | "metrics_json" | "completed_at">>
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("detector_runs")
    .update({ ...updates, completed_at: updates.completed_at ?? undefined })
    .eq("id", id);
  return { error: error as Error | null };
}

export async function listDetectorRuns(
  supabase: SupabaseClient,
  params: { orgId: string; detectorDefinitionId?: string; limit?: number }
): Promise<{ data: DetectorRunRow[]; error: Error | null }> {
  let q = supabase
    .from("detector_runs")
    .select("*")
    .eq("org_id", params.orgId)
    .order("started_at", { ascending: false })
    .limit(params.limit ?? 20);
  if (params.detectorDefinitionId) q = q.eq("detector_definition_id", params.detectorDefinitionId);
  const { data, error } = await q;
  return { data: (data ?? []) as DetectorRunRow[], error: error as Error | null };
}
