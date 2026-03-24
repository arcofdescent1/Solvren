import type { SupabaseClient } from "@supabase/supabase-js";
import { upsertProviderIntegrationAccount } from "../../core/providerAccountLinkService";

export async function linkJiraIntegrationAccount(
  supabase: SupabaseClient,
  input: { orgId: string; userId?: string | null; cloudId?: string | null; siteName?: string | null }
): Promise<{ integrationAccountId: string; created: boolean }> {
  const linked = await upsertProviderIntegrationAccount(supabase, {
    orgId: input.orgId,
    provider: "jira",
    installedByUserId: input.userId ?? null,
    status: "connected",
    metadata: {
      cloudId: input.cloudId ?? null,
      siteName: input.siteName ?? null,
    },
  });
  return { integrationAccountId: linked.id, created: linked.created };
}
