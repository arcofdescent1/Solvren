/**
 * JIT provisioning: create user and org membership on first SSO login
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedIdentity } from "./claimMapper";
import type { StoredOrgRole } from "./roleMapping";

export type JitResult = {
  userId: string;
  isNewUser: boolean;
  isNewMembership: boolean;
};

export async function ensureUserAndMembership(
  admin: SupabaseClient,
  orgId: string,
  providerId: string,
  identity: NormalizedIdentity,
  role: StoredOrgRole
): Promise<JitResult> {
  const { data: existingExt } = await admin
    .from("external_identities")
    .select("user_id")
    .eq("org_id", orgId)
    .eq("provider_id", providerId)
    .eq("external_subject", identity.externalSubject)
    .maybeSingle();

  if (existingExt) {
    const userId = (existingExt as { user_id: string }).user_id;
    const { data: member } = await admin
      .from("organization_members")
      .select("user_id")
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .maybeSingle();
    if (member) {
      return { userId, isNewUser: false, isNewMembership: false };
    }
  }

  let userId: string;
  let isNewUser = false;

  if (existingExt != null) {
    userId = (existingExt as { user_id: string }).user_id;
  } else {
    const { data: existingId } = await admin.rpc("get_auth_user_id_by_email", {
      p_email: identity.email,
    });
    const existingUserId = existingId as string | null;
    if (existingUserId) {
      userId = existingUserId;
    } else {
      const { data: created, error } = await admin.auth.admin.createUser({
        email: identity.email,
        email_confirm: identity.emailVerified,
        user_metadata: {
          display_name: identity.displayName ?? undefined,
          given_name: identity.givenName ?? undefined,
          family_name: identity.familyName ?? undefined,
        },
      });
      if (error) throw new Error(error.message);
      if (!created?.user?.id) throw new Error("User creation failed");
      userId = created.user.id;
      isNewUser = true;
    }

    await admin.from("external_identities").upsert(
      {
        org_id: orgId,
        user_id: userId,
        provider_id: providerId,
        external_subject: identity.externalSubject,
        email: identity.email,
        email_verified: identity.emailVerified,
        given_name: identity.givenName,
        family_name: identity.familyName,
        display_name: identity.displayName,
        raw_claims: identity.rawClaims,
      },
      { onConflict: "org_id,provider_id,external_subject" }
    );
  }

  const { data: member } = await admin
    .from("organization_members")
    .select("user_id")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  const isNewMembership = !member;
  if (isNewMembership) {
    const { error } = await admin.from("organization_members").insert({
      org_id: orgId,
      user_id: userId,
      role,
    });
    if (error) throw new Error(error.message);
  }

  return { userId, isNewUser, isNewMembership };
}
