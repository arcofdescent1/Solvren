import type { OrgPurgeStepContext } from "../step-context";

/**
 * Membership rows cascade on org delete. This step clears org-scoped invites and similar
 * that are safe to remove early (idempotent).
 */
export async function runPurgeIdentityAccessStep(ctx: OrgPurgeStepContext): Promise<Record<string, unknown>> {
  if (ctx.dryRun) {
    return { dryRun: true };
  }
  const detail: Record<string, unknown> = {};

  const inv = await ctx.admin.from("org_invites").delete({ count: "exact" }).eq("org_id", ctx.orgId);
  if (inv.error) throw new Error(`purge_identity org_invites: ${inv.error.message}`);
  detail.org_invites_removed = inv.count ?? 0;

  const udp = await ctx.admin.from("user_domain_permissions").delete({ count: "exact" }).eq("org_id", ctx.orgId);
  if (!udp.error) detail.user_domain_permissions_removed = udp.count ?? 0;

  return detail;
}
