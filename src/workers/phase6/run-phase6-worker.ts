/**
 * Phase 6 — Shared worker runner (A2.3). Use service role env; run via `npm run worker:*`.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import {
  claimNextProcessingJob,
  completeProcessingJob,
  failProcessingJob,
  type ProcessingJobType,
} from "@/modules/jobs/processing-queue.repository";

export async function runPhase6WorkerOnce(
  jobType: ProcessingJobType,
  processPayload: (job: {
    id: string;
    org_id: string;
    payload: Record<string, unknown>;
  }) => Promise<void>
): Promise<boolean> {
  const supabase = createAdminClient();
  const { data: job, error } = await claimNextProcessingJob(supabase, jobType);
  if (error) {
     
    console.error("[phase6-worker]", jobType, error.message);
    return false;
  }
  if (!job) return false;

  try {
    await processPayload({
      id: job.id,
      org_id: job.org_id,
      payload: (job.payload ?? {}) as Record<string, unknown>,
    });
    await completeProcessingJob(supabase, job.id);
     
    console.log("[phase6-worker]", jobType, "completed", job.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await failProcessingJob(supabase, job.id, msg, job.attempts, job.max_attempts);
     
    console.error("[phase6-worker]", jobType, "failed", job.id, msg);
  }
  return true;
}

export async function drainPhase6Worker(
  jobType: ProcessingJobType,
  processPayload: (job: {
    id: string;
    org_id: string;
    payload: Record<string, unknown>;
  }) => Promise<void>,
  maxIterations = 50
): Promise<void> {
  for (let i = 0; i < maxIterations; i++) {
    const did = await runPhase6WorkerOnce(jobType, processPayload);
    if (!did) break;
  }
}
