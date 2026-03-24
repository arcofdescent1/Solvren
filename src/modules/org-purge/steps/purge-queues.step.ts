import type { OrgPurgeStepContext } from "../step-context";

export async function runPurgeQueuesStep(ctx: OrgPurgeStepContext): Promise<Record<string, unknown>> {
  if (ctx.dryRun) {
    return { dryRun: true };
  }
  const detail: Record<string, unknown> = {};

  const pj = await ctx.admin.from("processing_jobs").delete({ count: "exact" }).eq("org_id", ctx.orgId);
  if (pj.error) throw new Error(`purge_queues processing_jobs: ${pj.error.message}`);
  detail.processing_jobs_removed = pj.count ?? 0;

  const rj = await ctx.admin.from("integration_replay_jobs").delete({ count: "exact" }).eq("org_id", ctx.orgId);
  if (!rj.error) detail.integration_replay_jobs_removed = rj.count ?? 0;

  const sr = await ctx.admin.from("signal_replay_requests").delete({ count: "exact" }).eq("org_id", ctx.orgId);
  if (!sr.error) detail.signal_replay_requests_removed = sr.count ?? 0;

  return detail;
}
