import type { SupabaseClient } from "@supabase/supabase-js";

export type VerificationRunRow = {
  id: string;
  issue_id: string;
  verification_type: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  result_summary: string | null;
  result_json: unknown;
  triggered_by: string | null;
};

export async function insertVerificationRun(
  supabase: SupabaseClient,
  payload: {
    issue_id: string;
    verification_type: string;
    status: string;
    triggered_by?: string | null;
  }
): Promise<{ data: VerificationRunRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("verification_runs")
    .insert({
      issue_id: payload.issue_id,
      verification_type: payload.verification_type,
      status: payload.status,
      triggered_by: payload.triggered_by ?? null,
    })
    .select()
    .single();
  if (error) return { data: null, error };
  return { data: data as VerificationRunRow, error: null };
}

export async function updateVerificationRun(
  supabase: SupabaseClient,
  runId: string,
  update: { status: string; completed_at: string; result_summary?: string | null; result_json?: unknown }
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("verification_runs")
    .update(update)
    .eq("id", runId);
  return { error: error ?? null };
}
