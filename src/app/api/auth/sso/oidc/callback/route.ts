/**
 * GET /api/auth/sso/oidc/callback
 * OIDC callback - exchange code, validate, then completeSsoLogin
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  exchangeCodeForTokens,
  validateIdToken,
  fetchOidcDiscovery,
  getJwksUriFromIssuer,
} from "@/services/sso/oidc";
import { normalizeOidcClaims } from "@/services/sso/claimMapper";
import { completeSsoLogin } from "@/services/sso/completeSsoLogin";
import { env } from "@/lib/env";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const baseUrl = env.appUrl.replace(/\/$/, "");
  const failureUrl = `${baseUrl}/login?error=sso_failed`;

  if (!code || !state) {
    return NextResponse.redirect(failureUrl);
  }

  const admin = createAdminClient();

  const { data: session, error: sessErr } = await admin
    .from("sso_auth_sessions")
    .select("id, org_id, provider_id, nonce, redirect_success_url, redirect_failure_url, expires_at")
    .eq("state", state)
    .maybeSingle();

  if (sessErr || !session) {
    return NextResponse.redirect(failureUrl);
  }

  const sess = session as { expires_at?: string | null };
  if (sess.expires_at && new Date(sess.expires_at) < new Date()) {
    await admin.from("sso_auth_sessions").delete().eq("state", state);
    return NextResponse.redirect(failureUrl);
  }

  const orgId = (session as { org_id: string }).org_id;
  const providerId = (session as { provider_id: string }).provider_id;
  const nonce = (session as { nonce: string }).nonce;
  const successUrl = (session as { redirect_success_url?: string }).redirect_success_url ?? `${baseUrl}/dashboard`;
  const failUrl = (session as { redirect_failure_url?: string }).redirect_failure_url ?? failureUrl;

  await admin.from("sso_auth_sessions").delete().eq("state", state);

  const { data: provider } = await admin
    .from("sso_providers")
    .select("issuer, token_endpoint, jwks_uri, client_id, client_secret, userinfo_endpoint, allow_jit_provisioning, attribute_mappings, default_role")
    .eq("id", providerId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!provider) {
    return NextResponse.redirect(failUrl);
  }

  const p = provider as {
    issuer?: string;
    token_endpoint?: string;
    jwks_uri?: string;
    client_id?: string;
    client_secret?: string;
    userinfo_endpoint?: string;
    allow_jit_provisioning?: boolean;
    attribute_mappings?: Record<string, string>;
    default_role?: string | null;
  };

  const redirectUri = `${baseUrl}/api/auth/sso/oidc/callback`;

  try {
    let tokenEndpoint = p.token_endpoint;
    let jwksUri = p.jwks_uri;
    if (!tokenEndpoint || !jwksUri) {
      if (!p.issuer) throw new Error("Missing issuer");
      const discovery = await fetchOidcDiscovery(p.issuer);
      tokenEndpoint = discovery.tokenEndpoint;
      jwksUri = discovery.jwksUri;
    }

    const tokens = await exchangeCodeForTokens(
      code,
      redirectUri,
      p.client_id ?? "",
      p.client_secret ?? "",
      tokenEndpoint ?? ""
    );

    const payload = await validateIdToken({
      idToken: tokens.idToken,
      issuer: p.issuer ?? "",
      clientId: p.client_id ?? "",
      jwksUri: jwksUri ?? getJwksUriFromIssuer(p.issuer ?? ""),
      nonce,
    });

    const claims = payload as Record<string, unknown>;
    const identity = normalizeOidcClaims(claims, p.attribute_mappings);
    const allowJit = p.allow_jit_provisioning !== false;
    const defaultRole = (p.default_role && ["owner","admin","reviewer","submitter","approver","viewer"].includes(p.default_role))
      ? (p.default_role as "owner"|"admin"|"reviewer"|"submitter"|"approver"|"viewer")
      : undefined;

    const result = await completeSsoLogin({
      admin,
      orgId,
      providerId,
      identity,
      protocol: "oidc",
      allowJit,
      defaultRole,
      successRedirectUrl: successUrl,
    });

    if (result.ok) {
      return NextResponse.redirect(result.redirectUrl);
    }
    const suffix = result.failureReason === "jit_disabled" ? "&hint=jit_disabled" : "";
    return NextResponse.redirect(`${failUrl}${suffix}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "OIDC callback failed";
    await admin.from("sso_login_events").insert({
      org_id: orgId,
      provider_id: providerId,
      protocol: "oidc",
      event_type: "callback",
      status: "failed",
      error_message: msg.slice(0, 500),
    });
  }

  return NextResponse.redirect(failUrl);
}
