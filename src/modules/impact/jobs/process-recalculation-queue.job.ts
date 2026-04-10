/**
 * Phase 5 — Process impact recalculation queue (§15).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  claimNextQueuedJob,
  completeRecalcJob,
  failRecalcJob,
  type RecalcJobRow,
} from "../persistence/impact-recalculation-jobs.repository";
import { assessImpact } from "../engine/impact-engine.service";

export async function processRecalculationQueue(
  supabase: SupabaseClient
): Promise<{ processed: number; succeeded: number; failed: number }> {
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (;;) {
    const { data: job } = await claimNextQueuedJob(supabase);
    if (!job) break;

    processed++;
    try {
      const result = await runJob(supabase, job);
      if (result.ok) {
        succeeded++;
        await completeRecalcJob(supabase, job.id, result.results ?? {});
      } else {
        failed++;
        await failRecalcJob(supabase, job.id, result.error ?? "Unknown error");
      }
    } catch (e) {
      failed++;
      await failRecalcJob(supabase, job.id, e instanceof Error ? e.message : "Job threw");
    }
  }

  return { processed, succeeded, failed };
}

async function runJob(
  supabase: SupabaseClient,
  job: RecalcJobRow
): Promise<{ ok: boolean; results?: Record<string, unknown>; error?: string }> {
  const scope = job.scope_ref_json as Record<string, string>;
  const orgId = job.org_id;

  if (job.scope_type === "issue") {
    const issueId = scope.issueId ?? scope.issue_id;
    if (!issueId) return { ok: false, error: "Missing issueId" };
    const findingId = scope.findingId ?? scope.finding_id ?? null;
    const detectorKey = scope.detectorKey ?? scope.detector_key ?? null;
    const result = await assessImpact(supabase, {
      orgId,
      issueId,
      findingId,
      detectorKey,
    });
    return result.ok ? { ok: true, results: { assessmentId: result.assessmentId } } : { ok: false, error: result.error };
  }

  if (job.scope_type === "org_all") {
    const { data: issues } = await supabase
      .from("issues")
      .select("id, source_type, source_ref")
      .eq("org_id", orgId)
      .in("status", ["open", "triaged", "assigned", "in_progress"]);

    let done = 0;
    let errs = 0;
    for (const i of issues ?? []) {
      const row = i as { id: string; source_type: string; source_ref: string };
      if (row.source_type !== "detector" || !row.source_ref) continue;
      const r = await assessImpact(supabase, {
        orgId,
        issueId: row.id,
        findingId: row.source_ref,
        detectorKey: null,
      });
      if (r.ok) done++;
      else errs++;
    }
    return { ok: true, results: { recalculated: done, errors: errs } };
  }

  return { ok: false, error: `Unsupported scope_type: ${job.scope_type}` };
}
