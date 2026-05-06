/**
 * Phase 1 — Salesforce REST SOQL using OAuth web-server tokens (refresh_token grant).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { revealCredentialTokenFields, sealCredentialTokenFields } from "@/lib/server/integrationTokenFields";
import { systemCredentialReveal } from "@/modules/integrations/secrets/integration-secrets.service";
import { refreshAccessTokenWithRefreshToken } from "@/services/salesforce/SalesforceAuthService";
import { retryWithBackoff, RETRY_PRESETS } from "@/lib/retry/retryWithBackoff";

const TOKEN_BUFFER_MS = 120_000;

export type SfRestContext = {
  accessToken: string;
  instanceUrl: string;
  environment: "production" | "sandbox";
};

export async function getSalesforceOAuthRestContext(
  admin: SupabaseClient,
  orgId: string
): Promise<SfRestContext | null> {
  const clientId = env.salesforceConnectedAppClientId;
  const clientSecret = env.salesforceConnectedAppClientSecret;
  if (!clientId || !clientSecret) return null;

  const { data: sfOrg } = await admin
    .from("salesforce_orgs")
    .select("environment, instance_url, auth_mode")
    .eq("org_id", orgId)
    .maybeSingle();

  if (!sfOrg || (sfOrg as { auth_mode?: string }).auth_mode !== "web_server") return null;

  const environment = (sfOrg as { environment: string }).environment as "production" | "sandbox";
  let instanceUrl = (sfOrg as { instance_url: string }).instance_url;

  const { data: credsRaw } = await admin
    .from("integration_credentials")
    .select("access_token, refresh_token, expires_at")
    .eq("org_id", orgId)
    .eq("provider", "salesforce")
    .maybeSingle();

  if (!credsRaw) return null;
  const creds = revealCredentialTokenFields(
    credsRaw as Record<string, unknown>,
    systemCredentialReveal(orgId, "salesforce", "oauth_refresh"),
  ) as {
    access_token?: string;
    refresh_token?: string;
    expires_at?: string | null;
  };

  const now = Date.now();
  const exp = creds.expires_at ? new Date(creds.expires_at).getTime() : 0;
  const refresh = creds.refresh_token?.trim();
  if (creds.access_token && exp - TOKEN_BUFFER_MS > now && instanceUrl) {
    return { accessToken: creds.access_token, instanceUrl, environment };
  }
  if (!refresh) return null;

  const refreshed = await retryWithBackoff(
    () =>
      refreshAccessTokenWithRefreshToken({
        environment,
        clientId,
        clientSecret,
        refreshToken: refresh,
      }),
    RETRY_PRESETS.oauthRefresh
  );

  instanceUrl = refreshed.instanceUrl;
  const expiresAt = new Date(now + 3600 * 1000).toISOString();

  await admin.from("integration_credentials").upsert(
    sealCredentialTokenFields({
      org_id: orgId,
      provider: "salesforce",
      access_token: refreshed.accessToken,
      refresh_token: refreshed.refresh_token ?? refresh,
      expires_at: expiresAt,
    }),
    { onConflict: "org_id,provider" }
  );

  await admin
    .from("salesforce_orgs")
    .update({ instance_url: instanceUrl, updated_at: new Date().toISOString() })
    .eq("org_id", orgId);

  return { accessToken: refreshed.accessToken, instanceUrl, environment };
}

export async function salesforceOAuthQuery<T = Record<string, unknown>>(
  ctx: SfRestContext,
  soql: string
): Promise<{ records: T[]; done: boolean }> {
  const ver = env.salesforceApiVersion.startsWith("v") ? env.salesforceApiVersion : `v${env.salesforceApiVersion}`;
  const url = `${ctx.instanceUrl}/services/data/${ver}/query?q=${encodeURIComponent(soql)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${ctx.accessToken}`, Accept: "application/json" },
  });
  const data = (await res.json()) as { records?: T[]; done?: boolean; message?: string };
  if (!res.ok) {
    throw new Error(data.message ?? `SOQL failed: ${res.status}`);
  }
  return { records: (data.records ?? []) as T[], done: data.done ?? true };
}
