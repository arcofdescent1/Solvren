/**
 * POST /api/auth/sso/saml/acs
 * SAML Assertion Consumer Service - handle SAMLResponse
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseSamlResponse, verifySamlResponseSignature } from "@/services/sso/saml";
import { completeSsoLogin } from "@/services/sso/completeSsoLogin";
import { env } from "@/lib/env";

export async function POST(req: NextRequest) {
  const baseUrl = env.appUrl.replace(/\/$/, "");
  const failureUrl = `${baseUrl}/login?error=sso_failed`;

  const formData = await req.formData().catch(() => null);
  const samlResponse = formData?.get("SAMLResponse") ?? formData?.get("SAMLresponse");
  const relayState = formData?.get("RelayState");

  if (!samlResponse || typeof samlResponse !== "string" || !relayState || typeof relayState !== "string") {
    return NextResponse.redirect(failureUrl);
  }

  const admin = createAdminClient();

  const { data: session, error: sessErr } = await admin
    .from("sso_auth_sessions")
    .select("id, org_id, provider_id, redirect_success_url, redirect_failure_url, expires_at")
    .eq("state", relayState)
    .maybeSingle();

  if (sessErr || !session) {
    return NextResponse.redirect(failureUrl);
  }

  const sess = session as { expires_at?: string | null };
  if (sess.expires_at && new Date(sess.expires_at) < new Date()) {
    await admin.from("sso_auth_sessions").delete().eq("state", relayState);
    return NextResponse.redirect(failureUrl);
  }

  const orgId = (session as { org_id: string }).org_id;
  const providerId = (session as { provider_id: string }).provider_id;
  const failUrl = (session as { redirect_failure_url?: string }).redirect_failure_url ?? failureUrl;

  await admin.from("sso_auth_sessions").delete().eq("state", relayState);

  const { data: provider } = await admin
    .from("sso_providers")
    .select("saml_certificate, allow_jit_provisioning, attribute_mappings, default_role")
    .eq("id", providerId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!provider) {
    return NextResponse.redirect(failUrl);
  }

  const p = provider as {
    saml_certificate?: string | null;
    allow_jit_provisioning?: boolean;
    attribute_mappings?: Record<string, string>;
    default_role?: string | null;
  };

  try {
    if (p.saml_certificate && !verifySamlResponseSignature(samlResponse, p.saml_certificate)) {
      await admin.from("sso_login_events").insert({
        org_id: orgId,
        provider_id: providerId,
        protocol: "saml",
        event_type: "acs",
        status: "failed",
        error_code: "invalid_signature",
        error_message: "SAML response signature verification failed",
      });
      return NextResponse.redirect(failUrl);
    }

    const { identity } = await parseSamlResponse(samlResponse, p.attribute_mappings ?? undefined);
    const allowJit = p.allow_jit_provisioning !== false;

    const defaultRole = (p.default_role && ["owner","admin","reviewer","submitter","approver","viewer"].includes(p.default_role))
      ? (p.default_role as "owner"|"admin"|"reviewer"|"submitter"|"approver"|"viewer")
      : undefined;

    const result = await completeSsoLogin({
      admin,
      orgId,
      providerId,
      identity,
      protocol: "saml",
      allowJit,
      defaultRole,
    });

    if (!result.ok) {
      return NextResponse.redirect(`${failUrl}${result.failureReason === "jit_disabled" ? "&hint=jit_disabled" : ""}`);
    }

    return NextResponse.redirect(result.redirectUrl);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "SAML ACS failed";
    await admin.from("sso_login_events").insert({
      org_id: orgId,
      provider_id: providerId,
      protocol: "saml",
      event_type: "acs",
      status: "failed",
      error_message: msg.slice(0, 500),
    });
  }

  return NextResponse.redirect(failUrl);
}
