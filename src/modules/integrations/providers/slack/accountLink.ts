import type { SupabaseClient } from "@supabase/supabase-js";
import { upsertProviderIntegrationAccount } from "../../core/providerAccountLinkService";

export async function linkSlackIntegrationAccount(
  supabase: SupabaseClient,
  input: { orgId: string; userId?: string | null; teamId?: string | null; teamName?: string | null }
): Promise<{ integrationAccountId: string; created: boolean }> {
  const linked = await upsertProviderIntegrationAccount(supabase, {
    orgId: input.orgId,
    provider: "slack",
    installedByUserId: input.userId ?? null,
    status: "connected",
    metadata: {
      teamId: input.teamId ?? null,
      teamName: input.teamName ?? null,
    },
  });
  return { integrationAccountId: linked.id, created: linked.created };
}
