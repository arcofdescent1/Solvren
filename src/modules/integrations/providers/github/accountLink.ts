import type { SupabaseClient } from "@supabase/supabase-js";
import { upsertProviderIntegrationAccount } from "../../core/providerAccountLinkService";

export async function linkGitHubIntegrationAccount(
  supabase: SupabaseClient,
  input: { orgId: string; userId?: string | null; installationId?: number | null; accountLogin?: string | null }
): Promise<{ integrationAccountId: string; created: boolean }> {
  const linked = await upsertProviderIntegrationAccount(supabase, {
    orgId: input.orgId,
    provider: "github",
    installedByUserId: input.userId ?? null,
    status: "connected",
    metadata: {
      installationId: input.installationId ?? null,
      accountLogin: input.accountLogin ?? null,
    },
  });
  return { integrationAccountId: linked.id, created: linked.created };
}
