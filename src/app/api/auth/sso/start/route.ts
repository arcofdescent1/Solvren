/**
 * POST /api/auth/sso/start
 * Unified SSO orchestration — branches to SAML or OIDC based on provider protocol.
 * Request: { organizationId, providerId, email? }
 * Response: { mode: "redirect", redirectUrl: "..." }
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildAuthnRequest } from "@/services/sso/saml";
import { buildAuthorizeUrl, fetchOidcDiscovery } from "@/services/sso/oidc";
import { randomBytes } from "crypto";
import { env } from "@/lib/env";

const SESSION_TTL_MINUTES = 10;

export async function POST(req: Request) {
  let body: { organizationId: string; providerId: string; email?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { organizationId, providerId, email } = body;
  if (!organizationId || !providerId) {
    return NextResponse.json({ error: "organizationId and providerId required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: provider, error } = await admin
    .from("sso_providers")
    .select("id, org_id, protocol, saml_sso_url, saml_entity_id, issuer, authorization_endpoint, token_endpoint, jwks_uri, client_id, client_secret, scopes")
    .eq("id", providerId)
    .eq("org_id", organizationId)
    .eq("enabled", true)
    .maybeSingle();

  if (error || !provider) {
    return NextResponse.json({ error: "Provider not found or disabled" }, { status: 400 });
  }

  const p = provider as {
    protocol: string;
    saml_sso_url?: string | null;
    saml_entity_id?: string | null;
    issuer?: string | null;
    authorization_endpoint?: string | null;
    token_endpoint?: string | null;
    jwks_uri?: string | null;
    client_id?: string | null;
    client_secret?: string | null;
    scopes?: string | null;
  };

  const baseUrl = env.appUrl.replace(/\/$/, "");
  const successUrl = `${baseUrl}/dashboard`;
  const failureUrl = `${baseUrl}/login?error=sso_failed`;
  const expiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60 * 1000).toISOString();

  Promise.resolve(admin.rpc("cleanup_expired_sso_auth_sessions")).catch(() => {});

  if (p.protocol === "saml") {
    const idpSsoUrl = p.saml_sso_url;
    const idpEntityId = p.saml_entity_id ?? idpSsoUrl;
    if (!idpSsoUrl) {
      return NextResponse.json({ error: "SAML SSO URL not configured" }, { status: 400 });
    }

    const state = randomBytes(32).toString("hex");
    const acsUrl = `${baseUrl}/api/auth/sso/saml/acs`;
    const spEntityId = `${baseUrl}/api/auth/sso/saml/metadata`;

    await admin.from("sso_auth_sessions").insert({
      state,
      nonce: "saml",
      org_id: organizationId,
      provider_id: providerId,
      redirect_success_url: successUrl,
      redirect_failure_url: failureUrl,
      login_hint: email ?? null,
      expires_at: expiresAt,
    });

    const redirectUrl = buildAuthnRequest(acsUrl, spEntityId, idpSsoUrl, idpEntityId ?? "", state);
    return NextResponse.json({ mode: "redirect", redirectUrl });
  }

  if (p.protocol === "oidc") {
    if (!p.client_secret) {
      return NextResponse.json({ error: "OIDC provider not configured" }, { status: 400 });
    }
    let authEndpoint = p.authorization_endpoint;
    if (!authEndpoint && p.issuer) {
      try {
        const discovery = await fetchOidcDiscovery(p.issuer);
        authEndpoint = discovery.authorizationEndpoint;
      } catch {
        return NextResponse.json({ error: "OIDC discovery failed" }, { status: 400 });
      }
    }
    if (!authEndpoint) {
      return NextResponse.json({ error: "OIDC authorization endpoint not configured" }, { status: 400 });
    }

    const state = randomBytes(32).toString("hex");
    const nonce = randomBytes(16).toString("hex");
    const clientId = p.client_id ?? "";
    const scopes = p.scopes ?? "openid profile email";
    const redirectUri = `${baseUrl}/api/auth/sso/oidc/callback`;

    await admin.from("sso_auth_sessions").insert({
      state,
      nonce,
      org_id: organizationId,
      provider_id: providerId,
      redirect_success_url: successUrl,
      redirect_failure_url: failureUrl,
      login_hint: email ?? null,
      expires_at: expiresAt,
    });

    const authorizeUrl = buildAuthorizeUrl(
      authEndpoint,
      clientId,
      redirectUri,
      state,
      nonce,
      scopes,
      email ?? undefined
    );
    return NextResponse.json({ mode: "redirect", redirectUrl: authorizeUrl });
  }

  return NextResponse.json({ error: "Unsupported protocol" }, { status: 400 });
}
