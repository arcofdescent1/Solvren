import type { SupabaseClient } from "@supabase/supabase-js";

export type GovernanceCalibrationRecommendationRow = {
  id: string;
  org_id: string;
  parameter_key: string;
  current_value_json: unknown;
  proposed_value_json: unknown;
  min_bound_json: unknown | null;
  max_bound_json: unknown | null;
  evidence_summary_json: Record<string, unknown>;
  simulation_summary_json: Record<string, unknown>;
  trace_window_start: string | null;
  trace_window_end: string | null;
  status: string;
  calibration_job_version: string | null;
  created_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_rationale: string | null;
};

export async function listCalibrationRecommendationsForOrg(
  supabase: SupabaseClient,
  orgId: string,
  opts?: { limit?: number; status?: string }
): Promise<{ data: GovernanceCalibrationRecommendationRow[]; error: Error | null }> {
  let q = supabase
    .from("governance_calibration_recommendations")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 50);
  if (opts?.status) q = q.eq("status", opts.status);
  const { data, error } = await q;
  if (error) return { data: [], error: error as Error };
  return { data: (data ?? []) as GovernanceCalibrationRecommendationRow[], error: null };
}

export async function updateCalibrationRecommendationStatus(
  supabase: SupabaseClient,
  id: string,
  orgId: string,
  updates: {
    status: "REVIEWED" | "ACCEPTED" | "REJECTED";
    reviewed_by: string;
    review_rationale?: string | null;
  }
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("governance_calibration_recommendations")
    .update({
      status: updates.status,
      reviewed_by: updates.reviewed_by,
      reviewed_at: new Date().toISOString(),
      review_rationale: updates.review_rationale ?? null,
    })
    .eq("id", id)
    .eq("org_id", orgId);

  return { error: error as Error | null };
}

export async function insertCalibrationRecommendation(
  supabase: SupabaseClient,
  input: {
    org_id: string;
    parameter_key: string;
    current_value_json: unknown;
    proposed_value_json: unknown;
    min_bound_json?: unknown;
    max_bound_json?: unknown;
    evidence_summary_json: Record<string, unknown>;
    simulation_summary_json: Record<string, unknown>;
    trace_window_start?: string | null;
    trace_window_end?: string | null;
    calibration_job_version?: string | null;
  }
): Promise<{ id: string | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("governance_calibration_recommendations")
    .insert({
      org_id: input.org_id,
      parameter_key: input.parameter_key,
      current_value_json: input.current_value_json as Record<string, unknown>,
      proposed_value_json: input.proposed_value_json as Record<string, unknown>,
      min_bound_json: input.min_bound_json as Record<string, unknown> | null,
      max_bound_json: input.max_bound_json as Record<string, unknown> | null,
      evidence_summary_json: input.evidence_summary_json,
      simulation_summary_json: input.simulation_summary_json,
      trace_window_start: input.trace_window_start ?? null,
      trace_window_end: input.trace_window_end ?? null,
      status: "DRAFT",
      calibration_job_version: input.calibration_job_version ?? null,
    })
    .select("id")
    .single();

  if (error) return { id: null, error: error as Error };
  return { id: (data as { id: string })?.id ?? null, error: null };
}
