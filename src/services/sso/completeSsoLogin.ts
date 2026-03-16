/**
 * Shared SSO completion: JIT check, role resolution, user/membership, session issue.
 * Used by OIDC callback and SAML ACS.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedIdentity } from "./claimMapper";
import { resolveRoleFromMappings } from "./roleMapping";
import { ensureUserAndMembership } from "./jitProvisioning";
import { env } from "@/lib/env";
import { auditLog } from "@/lib/audit";

export type CompleteSsoLoginParams = {
  admin: SupabaseClient;
  orgId: string;
  providerId: string;
  identity: NormalizedIdentity;
  protocol: "oidc" | "saml";
  allowJit: boolean;
  /** Optional; defaults to APP_URL/dashboard */
  successRedirectUrl?: string;
};

export type CompleteSsoLoginResult =
  | { ok: true; redirectUrl: string }
  | { ok: false; failureReason: string };

export async function completeSsoLogin(
  params: CompleteSsoLoginParams
): Promise<CompleteSsoLoginResult> {
  const { admin, orgId, providerId, identity, protocol, allowJit, successRedirectUrl } = params;
  const baseUrl = env.appUrl.replace(/\/$/, "");
  const failUrl = `${baseUrl}/login?error=sso_failed`;
  const successUrl = successRedirectUrl ?? `${baseUrl}/dashboard`;

  if (!identity.email) {
    await admin.from("sso_login_events").insert({
      org_id: orgId,
      provider_id: providerId,
      protocol,
      event_type: "callback",
      email: null,
      external_subject: identity.externalSubject,
      status: "failed",
      error_code: "missing_email",
      error_message: "Email claim required",
    });
    return { ok: false, failureReason: "missing_email" };
  }

  const { data: existingExt } = await admin
    .from("external_identities")
    .select("user_id")
    .eq("org_id", orgId)
    .eq("provider_id", providerId)
    .eq("external_subject", identity.externalSubject)
    .maybeSingle();

  if (!existingExt && !allowJit) {
    await admin.from("sso_login_events").insert({
      org_id: orgId,
      provider_id: providerId,
      protocol,
      event_type: "callback",
      email: identity.email,
      external_subject: identity.externalSubject,
      status: "blocked",
      error_code: "sso_user_not_authorized",
      error_message: "JIT provisioning disabled; user must be invited first",
    });
    return { ok: false, failureReason: "jit_disabled" };
  }

  const role = await resolveRoleFromMappings(admin, providerId, identity, "viewer");

  await ensureUserAndMembership(admin, orgId, providerId, identity, role);

  await admin.from("sso_login_events").insert({
    org_id: orgId,
    provider_id: providerId,
    protocol,
    event_type: "callback",
    email: identity.email,
    external_subject: identity.externalSubject,
    status: "success",
  });

  try {
    await auditLog(admin as unknown as SupabaseClient, {
      orgId,
      actorId: null,
      actorType: "SYSTEM",
      action: "sso.login.success",
      entityType: "sso_login",
      metadata: { providerId, protocol, email: identity.email },
    });
  } catch {
    // non-fatal
  }

  const { data: link } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: identity.email,
    options: { redirectTo: successUrl },
  });

  const href = (link as { properties?: { action_link?: string } } | null)?.properties?.action_link;
  if (href) {
    return { ok: true, redirectUrl: href };
  }

  return { ok: true, redirectUrl: successUrl };
}
