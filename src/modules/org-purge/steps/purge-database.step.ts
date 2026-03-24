import type { OrgPurgeStepContext } from "../step-context";

export async function runPurgeDatabaseStep(ctx: OrgPurgeStepContext): Promise<Record<string, unknown>> {
  if (ctx.dryRun) {
    return { dryRun: true };
  }

  const { error: aErr, count: auditDeleted } = await ctx.admin.from("audit_log").delete({ count: "exact" }).eq("org_id", ctx.orgId);
  if (aErr) throw new Error(`purge_database audit_log: ${aErr.message}`);

  const { data: org } = await ctx.admin.from("organizations").select("id").eq("id", ctx.orgId).maybeSingle();
  if (!org) {
    return { audit_log_deleted: auditDeleted ?? 0, organization_deleted: 0, skipped: true, reason: "org_already_gone" };
  }

  const { error: oErr, count: orgDel } = await ctx.admin.from("organizations").delete({ count: "exact" }).eq("id", ctx.orgId);
  if (oErr) throw new Error(`purge_database organizations: ${oErr.message}`);

  return {
    audit_log_deleted: auditDeleted ?? 0,
    organization_deleted: orgDel ?? 0,
  };
}
