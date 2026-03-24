/**
 * POST /api/auth/sso/saml/start
 * Start SAML flow - returns redirect URL to IdP
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildAuthnRequest } from "@/services/sso/saml";
import { randomBytes } from "crypto";
import { env } from "@/lib/env";

export async function POST(req: Request) {
  let body: { organizationId: string; providerId: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { organizationId, providerId } = body;
  if (!organizationId || !providerId) {
    return NextResponse.json({ error: "organizationId and providerId required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: provider, error } = await admin
    .from("sso_providers")
    .select("id, org_id, saml_sso_url, saml_entity_id, protocol")
    .eq("id", providerId)
    .eq("org_id", organizationId)
    .eq("enabled", true)
    .eq("protocol", "saml")
    .maybeSingle();

  if (error || !provider) {
    return NextResponse.json({ error: "SAML provider not found or disabled" }, { status: 400 });
  }

  const p = provider as { saml_sso_url?: string; saml_entity_id?: string };
  const idpSsoUrl = p.saml_sso_url;
  const idpEntityId = p.saml_entity_id ?? idpSsoUrl;

  if (!idpSsoUrl) {
    return NextResponse.json({ error: "SAML SSO URL not configured" }, { status: 400 });
  }

  const baseUrl = env.appUrl.replace(/\/$/, "");
  const acsUrl = `${baseUrl}/api/auth/sso/saml/acs`;
  const spEntityId = `${baseUrl}/api/auth/sso/saml/metadata`;

  const state = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await admin.from("sso_auth_sessions").insert({
    state,
    nonce: "saml",
    org_id: organizationId,
    provider_id: providerId,
    redirect_success_url: `${baseUrl}/dashboard`,
    redirect_failure_url: `${baseUrl}/login?error=sso_failed`,
    expires_at: expiresAt,
  });

  const redirectUrl = buildAuthnRequest(acsUrl, spEntityId, idpSsoUrl, idpEntityId ?? "", state);
  return NextResponse.json({ redirectUrl });
}
