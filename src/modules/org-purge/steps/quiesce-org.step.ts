import type { OrgPurgeStepContext } from "../step-context";

export async function runQuiesceOrgStep(ctx: OrgPurgeStepContext): Promise<Record<string, unknown>> {
  if (ctx.dryRun) {
    return { dryRun: true };
  }
  const { data: org } = await ctx.admin.from("organizations").select("id,purge_lifecycle_status").eq("id", ctx.orgId).maybeSingle();
  if (!org) {
    return { skipped: true, reason: "organization_already_removed" };
  }
  const { error } = await ctx.admin
    .from("organizations")
    .update({ purge_lifecycle_status: "PURGE_PENDING" })
    .eq("id", ctx.orgId);
  if (error) {
    throw new Error(`quiesce_org: ${error.message}`);
  }
  return { purge_lifecycle_status: "PURGE_PENDING" };
}
