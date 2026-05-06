import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { verifyOAuthState } from "@/lib/integrations/oauthState";
import { auditLog } from "@/lib/audit";
import { env } from "@/lib/env";
import { sealCredentialTokenFields } from "@/lib/server/integrationTokenFields";
import { recordFirstIntegrationConnected } from "@/lib/value-engine/metrics";
import { runValueEngineBackfillOrg } from "@/lib/value-engine/runValueEngineCron";
import { retryWithBackoff, RETRY_PRESETS } from "@/lib/retry/retryWithBackoff";
import { logIntegrationConnected } from "@/lib/telemetry/logIntegrationConnected";

async function exchangeCode(
  code: string,
  redirectUri: string,
  environment: "production" | "sandbox"
) {
  const clientId = env.salesforceConnectedAppClientId;
  const clientSecret = env.salesforceConnectedAppClientSecret;
  if (!clientId || !clientSecret) throw new Error("connected_app_not_configured");

  const tokenUrl =
    environment === "sandbox" ? env.salesforceTestLoginUrl : env.salesforceLoginUrl;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });
  const res = await fetch(`${tokenUrl}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    instance_url?: string;
    id?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok) throw new Error(json.error_description ?? json.error ?? "token_exchange_failed");
  if (!json.access_token || !json.instance_url) throw new Error("missing_token");
  return json;
}

function parseOrgIdFromIdentityUrl(idUrl: string | undefined): string {
  if (!idUrl) return "unknown";
  try {
    const u = new URL(idUrl);
    const parts = u.pathname.split("/").filter(Boolean);
    return parts[1] ?? "unknown";
  } catch {
    return "unknown";
  }
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();
  const base = new URL(req.url).origin;

  const code = req.nextUrl.searchParams.get("code");
  const stateParam = req.nextUrl.searchParams.get("state");

  if (!code || !stateParam) {
    return NextResponse.redirect(new URL("/org/settings/integrations/salesforce?salesforce=error&msg=missing", base));
  }

  let state: ReturnType<typeof verifyOAuthState>;
  try {
    state = verifyOAuthState("salesforce", stateParam);
  } catch {
    return NextResponse.redirect(new URL("/org/settings/integrations/salesforce?salesforce=error&msg=state", base));
  }

  const environment = state.sfEnvironment ?? "production";
  const redirectUri =
    env.salesforceOAuthRedirectUri ?? `${base}/api/integrations/salesforce/oauth/callback`;

  let tokens: Awaited<ReturnType<typeof exchangeCode>>;
  try {
    tokens = await exchangeCode(code, redirectUri, environment);
  } catch (e) {
    const msg = encodeURIComponent(e instanceof Error ? e.message : "oauth_failed");
    return NextResponse.redirect(new URL(`/org/settings/integrations/salesforce?salesforce=error&msg=${msg}`, base));
  }

  const sfOrgId = parseOrgIdFromIdentityUrl(tokens.id);
  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null;

  await admin.from("integration_credentials").upsert(
    sealCredentialTokenFields({
      org_id: state.orgId,
      provider: "salesforce",
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      expires_at: expiresAt,
      client_id: env.salesforceConnectedAppClientId ?? "",
    }),
    { onConflict: "org_id,provider" }
  );

  const loginHost = environment === "sandbox" ? env.salesforceTestLoginUrl : env.salesforceLoginUrl;

  await admin.from("integration_connections").upsert(
    {
      org_id: state.orgId,
      provider: "salesforce",
      status: "connected",
      config: { oauthWeb: true, sfOrgId },
    },
    { onConflict: "org_id,provider" }
  );

  const { data: conn } = await admin
    .from("integration_connections")
    .select("id")
    .eq("org_id", state.orgId)
    .eq("provider", "salesforce")
    .maybeSingle();

  await admin.from("salesforce_orgs").upsert(
    {
      org_id: state.orgId,
      integration_connection_id: (conn as { id?: string })?.id ?? null,
      sf_org_id: sfOrgId,
      instance_url: tokens.instance_url!,
      login_url: loginHost,
      environment,
      auth_mode: "web_server",
    },
    { onConflict: "org_id,sf_org_id" }
  );

  await auditLog(supabase, {
    orgId: state.orgId,
    actorId: state.userId,
    actorType: "USER",
    action: "salesforce.connected",
    entityType: "integration",
    entityId: "salesforce",
    metadata: { sfOrgId },
  });

  await recordFirstIntegrationConnected(admin, state.orgId);
  logIntegrationConnected(admin, { orgId: state.orgId, userId: state.userId, provider: "salesforce" });
  try {
    await retryWithBackoff(
      async () => {
        const r = await runValueEngineBackfillOrg(admin, state.orgId);
        if (!r.ok) throw new Error(r.errors.join("; ") || "value_engine_backfill_failed");
      },
      RETRY_PRESETS.integrationSync
    );
  } catch {
    /* best-effort backfill */
  }

  return NextResponse.redirect(
    new URL(`/org/settings/integrations/salesforce?orgId=${state.orgId}&salesforce=connected`, base)
  );
}
