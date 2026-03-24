/**
 * Phase 2 — Get HubSpot client for org.
 * Resolves credentials from integration_credentials (org_id, provider) or hubspot_accounts.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { revealCredentialTokenFields, sealCredentialTokenFields } from "@/lib/server/integrationTokenFields";
import { HubSpotClient } from "@/services/hubspot/HubSpotClient";
import { refreshAccessToken, needsRefresh } from "@/services/hubspot/HubSpotAuthService";

export async function getHubSpotClientForOrg(orgId: string): Promise<{
  client: HubSpotClient;
  hubId?: number;
} | null> {
  const admin = createAdminClient();
  const { data: account } = await admin
    .from("hubspot_accounts")
    .select("hub_id, auth_mode")
    .eq("org_id", orgId)
    .maybeSingle();
  const { data: credsRaw } = await admin
    .from("integration_credentials")
    .select("access_token, refresh_token, expires_at, private_app_token")
    .eq("org_id", orgId)
    .eq("provider", "hubspot")
    .maybeSingle();

  if (!account || !credsRaw) return null;

  const creds = revealCredentialTokenFields(credsRaw as Record<string, unknown>) as {
    access_token?: string;
    refresh_token?: string;
    expires_at?: string | null;
    private_app_token?: string;
  };

  const authMode = (account as { auth_mode: string }).auth_mode;
  let accessToken: string;

  if (authMode === "private_app") {
    accessToken = creds.private_app_token ?? creds.access_token ?? "";
  } else {
    const token = creds.access_token;
    const refresh = creds.refresh_token;
    const expiresAt = creds.expires_at ?? null;
    if (!token || !refresh) return null;
    if (needsRefresh(expiresAt)) {
      const refreshed = await refreshAccessToken(refresh);
      accessToken = refreshed.accessToken;
      await admin
        .from("integration_credentials")
        .update(sealCredentialTokenFields({ access_token: refreshed.accessToken }))
        .eq("org_id", orgId)
        .eq("provider", "hubspot");
    } else {
      accessToken = token;
    }
  }

  return {
    client: new HubSpotClient({ accessToken }),
    hubId: (account as { hub_id?: number }).hub_id,
  };
}

export async function getHubSpotClientForAccount(
  _supabase: SupabaseClient,
  orgId: string
): Promise<HubSpotClient | null> {
  const result = await getHubSpotClientForOrg(orgId);
  return result?.client ?? null;
}
