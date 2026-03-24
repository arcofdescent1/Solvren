import { disconnectIntegration } from "@/modules/integrations/auth/connectionManager";
import { getAccountsByOrg } from "@/modules/integrations/core/integrationAccountsRepo";
import type { OrgPurgeStepContext } from "../step-context";

export async function runPurgeIntegrationsStep(ctx: OrgPurgeStepContext): Promise<Record<string, unknown>> {
  const { data: accounts, error } = await getAccountsByOrg(ctx.admin, ctx.orgId);
  if (error) throw new Error(`purge_integrations list: ${error.message}`);

  if (ctx.dryRun) {
    return { dryRun: true, accountCount: accounts?.length ?? 0 };
  }

  const results: { id: string; provider: string; ok: boolean; error?: string }[] = [];
  for (const a of accounts ?? []) {
    const res = await disconnectIntegration(ctx.admin, {
      orgId: ctx.orgId,
      integrationAccountId: a.id,
      userId: ctx.actorUserId,
    });
    results.push({
      id: a.id,
      provider: a.provider,
      ok: !res.error,
      error: res.error,
    });
  }
  return { disconnected: results };
}
