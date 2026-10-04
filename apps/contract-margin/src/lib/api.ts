import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function requestUser() {
  const supabase = await serverSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user || !user.email_confirmed_at) return null;
  return { supabase, user };
}

export async function requestOwner(orgId: string) {
  const session = await requestUser();
  if (!session) return null;
  const { data: assurance } = await session.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.currentLevel !== "aal2") return null;
  const { data } = await session.supabase.from("organization_members")
    .select("role").eq("org_id", orgId).eq("user_id", session.user.id).maybeSingle();
  if (data?.role !== "owner") return null;
  return session;
}

export async function requestOrgRole(orgId: string, roles: Array<"owner" | "finance" | "engineer" | "viewer">) {
  const session = await requestUser();
  if (!session) return null;
  const { data: membership } = await session.supabase.from("organization_members")
    .select("role").eq("org_id", orgId).eq("user_id", session.user.id).maybeSingle();
  if (!membership || !roles.includes(membership.role)) return null;
  if (membership.role !== "viewer") {
    const { data: assurance } = await session.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance?.currentLevel !== "aal2") return null;
  }
  return { ...session, role: membership.role as "owner" | "finance" | "engineer" | "viewer" };
}

export async function verifyRecentTotp(
  supabase: NonNullable<Awaited<ReturnType<typeof requestUser>>>["supabase"],
  code: string,
) {
  if (!/^\d{6}$/.test(code)) return false;
  const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
  if (factorsError || !factors?.totp.length) return false;
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: factors.totp[0].id,
    code,
  });
  return !error;
}
