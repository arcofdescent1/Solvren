import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { revealCredentialTokenFields, sealCredentialTokenFields } from "@/lib/server/integrationTokenFields";
import { systemCredentialReveal } from "@/modules/integrations/secrets/integration-secrets.service";

const REFRESH_BUFFER_MS = 2 * 60 * 1000;

export async function ensureHubSpotAccessTokenForOrg(
  admin: SupabaseClient,
  orgId: string
): Promise<{ ok: true; accessToken: string } | { ok: false; error: string }> {
  const { data: credsRaw, error: readErr } = await admin
    .from("integration_credentials")
    .select("access_token, refresh_token, expires_at")
    .eq("org_id", orgId)
    .eq("provider", "hubspot")
    .maybeSingle();

  if (readErr) return { ok: false, error: readErr.message };
  if (!credsRaw) return { ok: false, error: "hubspot_not_connected" };

  const creds = revealCredentialTokenFields(credsRaw as Record<string, unknown>, systemCredentialReveal(orgId, "hubspot", "oauth_refresh")) as {
    access_token?: string;
    refresh_token?: string | null;
    expires_at?: string | null;
  };

  const now = Date.now();
  const exp = creds.expires_at ? new Date(creds.expires_at).getTime() : 0;
  if (creds.access_token && exp - REFRESH_BUFFER_MS > now) {
    return { ok: true, accessToken: creds.access_token };
  }

  const refresh = creds.refresh_token?.trim();
  if (!refresh) return { ok: false, error: "hubspot_missing_refresh_token" };

  const clientId = env.hubspotClientId;
  const clientSecret = env.hubspotClientSecret;
  if (!clientId || !clientSecret) return { ok: false, error: "hubspot_oauth_not_configured" };

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refresh,
  });

  const res = await fetch(env.hubspotOAuthTokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
  };

  if (!res.ok || !json.access_token) {
    return { ok: false, error: json.error ?? "hubspot_token_refresh_failed" };
  }

  const expiresAt = json.expires_in
    ? new Date(Date.now() + json.expires_in * 1000).toISOString()
    : null;

  await admin.from("integration_credentials").upsert(
    sealCredentialTokenFields({
      org_id: orgId,
      provider: "hubspot",
      access_token: json.access_token,
      refresh_token: json.refresh_token ?? refresh,
      expires_at: expiresAt,
    }),
    { onConflict: "org_id,provider" }
  );

  return { ok: true, accessToken: json.access_token };
}
