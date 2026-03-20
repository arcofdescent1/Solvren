/**
 * Phase 5 — Queue impact recalculation after assumption change (§15).
 * Enqueues jobs for all open detector-sourced issues in the org.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { insertRecalcJob } from "../persistence/impact-recalculation-jobs.repository";

export async function queueRecalculationAfterAssumptionChange(
  supabase: SupabaseClient,
  orgId: string,
  requestedByUserId?: string | null
): Promise<{ jobId: string; queued: boolean }> {
  const { data: job } = await insertRecalcJob(supabase, {
    org_id: orgId,
    scope_type: "org_all",
    scope_ref_json: {},
    reason: "assumption_change",
    requested_by_user_id: requestedByUserId ?? null,
  });
  if (!job) return { jobId: "", queued: false };
  return { jobId: job.id, queued: true };
}
