import type { SupabaseClient } from "@supabase/supabase-js";
import { upsertProviderIntegrationAccount } from "../../core/providerAccountLinkService";

export async function linkNetSuiteIntegrationAccount(
  supabase: SupabaseClient,
  input: { orgId: string; userId?: string | null; accountId?: string | null; accountName?: string | null; environment?: string | null }
): Promise<{ integrationAccountId: string; created: boolean }> {
  const linked = await upsertProviderIntegrationAccount(supabase, {
    orgId: input.orgId,
    provider: "netsuite",
    installedByUserId: input.userId ?? null,
    status: "connected",
    metadata: {
      accountId: input.accountId ?? null,
      accountName: input.accountName ?? null,
      environment: input.environment ?? null,
    },
    config: input.environment ? { environment: input.environment } : undefined,
  });
  return { integrationAccountId: linked.id, created: linked.created };
}
