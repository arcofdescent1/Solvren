/**
 * Phase 6 — DB-backed processing queue (A2.2). Workers use service-role Supabase client.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type ProcessingJobType =
  | "signal_ingestion"
  | "detector"
  | "action_execution"
  | "verification";

export type ProcessingJobRow = {
  id: string;
  org_id: string;
  job_type: ProcessingJobType;
  payload: Record<string, unknown>;
  status: string;
  priority: number;
  attempts: number;
  max_attempts: number;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

export async function enqueueProcessingJob(
  supabase: SupabaseClient,
  params: {
    orgId: string;
    jobType: ProcessingJobType;
    payload?: Record<string, unknown>;
    priority?: number;
    idempotencyKey?: string | null;
  }
): Promise<{ data: { id: string } | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("processing_jobs")
    .insert({
      org_id: params.orgId,
      job_type: params.jobType,
      payload: params.payload ?? {},
      priority: params.priority ?? 0,
      idempotency_key: params.idempotencyKey ?? null,
    })
    .select("id")
    .maybeSingle();

  return { data: data as { id: string } | null, error: error as Error | null };
}

/**
 * Best-effort claim: selects one pending job and transitions to running.
 * Concurrent workers may rarely race; acceptable for v1 (upgrade with SKIP LOCKED RPC later).
 */
export async function claimNextProcessingJob(
  supabase: SupabaseClient,
  jobType: ProcessingJobType
): Promise<{ data: ProcessingJobRow | null; error: Error | null }> {
  const { data: row, error: selErr } = await supabase
    .from("processing_jobs")
    .select(
      "id, org_id, job_type, payload, status, priority, attempts, max_attempts, error, created_at, started_at, completed_at"
    )
    .eq("job_type", jobType)
    .eq("status", "pending")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (selErr || !row) {
    return { data: null, error: selErr as Error | null };
  }

  const r = row as ProcessingJobRow;
  const nextAttempts = (r.attempts ?? 0) + 1;
  const { data: updated, error: upErr } = await supabase
    .from("processing_jobs")
    .update({
      status: "running",
      started_at: new Date().toISOString(),
      attempts: nextAttempts,
    })
    .eq("id", r.id)
    .eq("status", "pending")
    .select(
      "id, org_id, job_type, payload, status, priority, attempts, max_attempts, error, created_at, started_at, completed_at"
    )
    .maybeSingle();

  if (upErr || !updated) {
    return { data: null, error: upErr as Error | null };
  }

  return { data: updated as ProcessingJobRow, error: null };
}

export async function completeProcessingJob(
  supabase: SupabaseClient,
  jobId: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("processing_jobs")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      error: null,
    })
    .eq("id", jobId);
  return { error: error as Error | null };
}

export async function failProcessingJob(
  supabase: SupabaseClient,
  jobId: string,
  message: string,
  attempts: number,
  maxAttempts: number
): Promise<{ error: Error | null }> {
  const requeue = attempts < maxAttempts;
  const { error } = await supabase
    .from("processing_jobs")
    .update(
      requeue
        ? {
            status: "pending",
            error: message,
            started_at: null,
          }
        : {
            status: "dead_letter",
            error: message,
            completed_at: new Date().toISOString(),
          }
    )
    .eq("id", jobId);
  return { error: error as Error | null };
}

export async function countJobsByStatusForOrg(
  supabase: SupabaseClient,
  orgId: string,
  status: ProcessingJobRow["status"]
): Promise<{ count: number; error: Error | null }> {
  const { count, error } = await supabase
    .from("processing_jobs")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("status", status);
  return { count: count ?? 0, error: error as Error | null };
}
