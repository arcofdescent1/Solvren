/**
 * Phase 5 — impact_recalculation_jobs repository (§8.5).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type RecalcJobRow = {
  id: string;
  org_id: string;
  scope_type: "issue" | "finding" | "model_key" | "org_all";
  scope_ref_json: Record<string, unknown>;
  reason: string;
  requested_by_user_id: string | null;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  results_json: Record<string, unknown> | null;
  created_at: string;
};

export async function insertRecalcJob(
  supabase: SupabaseClient,
  input: {
    org_id: string;
    scope_type: RecalcJobRow["scope_type"];
    scope_ref_json: Record<string, unknown>;
    reason: string;
    requested_by_user_id?: string | null;
  }
): Promise<{ data: RecalcJobRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("impact_recalculation_jobs")
    .insert({ ...input, status: "queued" })
    .select()
    .single();
  return { data: data as RecalcJobRow | null, error: error as Error | null };
}

export async function claimNextQueuedJob(
  supabase: SupabaseClient
): Promise<{ data: RecalcJobRow | null; error: Error | null }> {
  const { data: jobs } = await supabase
    .from("impact_recalculation_jobs")
    .select("*")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1);
  const job = (jobs ?? [])[0] as RecalcJobRow | undefined;
  if (!job) return { data: null, error: null };

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("impact_recalculation_jobs")
    .update({ status: "running", started_at: now })
    .eq("id", job.id);
  if (error) return { data: null, error: error as Error };
  return { data: { ...job, status: "running", started_at: now }, error: null };
}

export async function completeRecalcJob(
  supabase: SupabaseClient,
  jobId: string,
  results: Record<string, unknown>
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("impact_recalculation_jobs")
    .update({ status: "completed", completed_at: new Date().toISOString(), results_json: results })
    .eq("id", jobId);
  return { error: error as Error | null };
}

export async function failRecalcJob(
  supabase: SupabaseClient,
  jobId: string,
  errorMessage: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("impact_recalculation_jobs")
    .update({ status: "failed", completed_at: new Date().toISOString(), results_json: { error: errorMessage } })
    .eq("id", jobId);
  return { error: error as Error | null };
}
