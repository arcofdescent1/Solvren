/**
 * @deprecated Phase 2 compatibility route. HubSpot runs through the new runtime layer.
 * OAuth callback for legacy setup wizard; to be folded into generic [provider]/connect/callback.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { verifyHubSpotState } from "@/lib/hubspot/state";
import { auditLog } from "@/lib/audit";
import { env } from "@/lib/env";
import { HubSpotClient } from "@/services/hubspot/HubSpotClient";
import { sealCredentialTokenFields } from "@/lib/server/integrationTokenFields";

async function exchangeCode(code: string, redirectUri: string) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: env.hubspotClientId!,
    client_secret: env.hubspotClientSecret!,
    code,
    redirect_uri: redirectUri,
  });
  const res = await fetch(env.hubspotOAuthTokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!res.ok) throw new Error(json.error_description ?? json.error ?? "OAuth token exchange failed");
  if (!json.access_token) throw new Error("No access_token in response");
  return { access_token: json.access_token, refresh_token: json.refresh_token, expires_in: json.expires_in };
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();

  const code = req.nextUrl.searchParams.get("code");
  const stateParam = req.nextUrl.searchParams.get("state");
  const base = new URL(req.url).origin;

  if (!code || !stateParam) {
    return NextResponse.redirect(new URL(`/org/settings/integrations/hubspot?hubspot=error&msg=missing_code_or_state`, base));
  }

  let state: { orgId: string; userId: string };
  try {
    state = verifyHubSpotState(stateParam);
  } catch {
    return NextResponse.redirect(new URL("/org/settings/integrations/hubspot?hubspot=error&msg=invalid_state", base));
  }

  const redirectUri = env.hubspotRedirectUri ?? `${base}/api/integrations/hubspot/oauth/callback`;

  let tokens: { access_token: string; refresh_token?: string; expires_in?: number };
  try {
    tokens = await exchangeCode(code, redirectUri);
  } catch (e) {
    const msg = encodeURIComponent(e instanceof Error ? e.message : "oauth_failed");
    return NextResponse.redirect(new URL(`/org/settings/integrations/hubspot?hubspot=error&msg=${msg}`, base));
  }

  const client = new HubSpotClient({ accessToken: tokens.access_token });
  let portalId: number;
  try {
    const info = await client.getAccountInfo();
    portalId = info.portalId;
  } catch {
    return NextResponse.redirect(new URL("/org/settings/integrations/hubspot?hubspot=error&msg=account_info_failed", base));
  }

  const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null;

  await admin.from("integration_credentials").upsert(
    sealCredentialTokenFields({
      org_id: state.orgId,
      provider: "hubspot",
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      expires_at: expiresAt,
    }),
    { onConflict: "org_id,provider" }
  );

  const { data: conn } = await admin
    .from("integration_connections")
    .upsert(
      {
        org_id: state.orgId,
        provider: "hubspot",
        status: "connected",
        config: { hubId: portalId, authMode: "oauth_public_app" },
      },
      { onConflict: "org_id,provider" }
    )
    .select("id")
    .single();

  await admin.from("hubspot_accounts").upsert(
    {
      org_id: state.orgId,
      integration_connection_id: (conn as { id?: string })?.id ?? null,
      hub_id: portalId,
      auth_mode: "oauth_public_app",
      connected_by_user_id: state.userId,
    },
    { onConflict: "org_id,hub_id" }
  );

  await auditLog(supabase, {
    orgId: state.orgId,
    actorId: state.userId,
    actorType: "USER",
    action: "hubspot.connected",
    entityType: "integration",
    entityId: "hubspot",
    metadata: { hubId: portalId },
  });

  return NextResponse.redirect(new URL(`/org/settings/integrations/hubspot?orgId=${state.orgId}&hubspot=connected`, base));
}
