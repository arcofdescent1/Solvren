/**
 * POST /api/auth/sso/oidc/start
 * Start OIDC auth flow - returns authorize URL
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildAuthorizeUrl, fetchOidcDiscovery } from "@/services/sso/oidc";
import { randomBytes } from "crypto";
import { env } from "@/lib/env";

export async function POST(req: Request) {
  let body: { organizationId: string; providerId: string; loginHint?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { organizationId, providerId, loginHint } = body;
  if (!organizationId || !providerId) {
    return NextResponse.json({ error: "organizationId and providerId required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: provider, error } = await admin
    .from("sso_providers")
    .select("id, org_id, issuer, authorization_endpoint, token_endpoint, jwks_uri, client_id, client_secret, scopes, protocol")
    .eq("id", providerId)
    .eq("org_id", organizationId)
    .eq("enabled", true)
    .eq("protocol", "oidc")
    .maybeSingle();

  if (error || !provider) {
    return NextResponse.json({ error: "Provider not found or disabled" }, { status: 400 });
  }

  const p = provider as {
    authorization_endpoint?: string;
    token_endpoint?: string;
    jwks_uri?: string;
    issuer?: string;
    client_id?: string;
    client_secret?: string;
    scopes?: string;
  };

  if (!p.client_secret) {
    return NextResponse.json({ error: "Provider not configured" }, { status: 400 });
  }

  let authEndpoint = p.authorization_endpoint;
  if (!authEndpoint && p.issuer) {
    const discovery = await fetchOidcDiscovery(p.issuer);
    authEndpoint = discovery.authorizationEndpoint;
  }
  if (!authEndpoint) {
    return NextResponse.json({ error: "Provider endpoints not configured" }, { status: 400 });
  }

  const state = randomBytes(32).toString("hex");
  const nonce = randomBytes(16).toString("hex");
  const clientId = p.client_id ?? "";
  const scopes = p.scopes ?? "openid profile email";

  const baseUrl = env.appUrl.replace(/\/$/, "");
  const redirectUri = `${baseUrl}/api/auth/sso/oidc/callback`;

  await admin.from("sso_auth_sessions").insert({
    state,
    nonce,
    org_id: organizationId,
    provider_id: providerId,
    redirect_success_url: `${baseUrl}/dashboard`,
    redirect_failure_url: `${baseUrl}/login?error=sso_failed`,
    login_hint: loginHint ?? null,
  });

  const authorizeUrl = buildAuthorizeUrl(
    authEndpoint,
    clientId,
    redirectUri,
    state,
    nonce,
    scopes,
    loginHint
  );

  return NextResponse.json({ authorizeUrl });
}
