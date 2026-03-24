import { createServerSupabaseClient } from "@/lib/supabase/server";
import { authStateFromUser } from "@/lib/auth";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";

/**
 * Legacy helper: first org + owner/admin role + verified email.
 * Prefer `requireOrgPermission(orgId, "org.settings.manage")` or `policy.manage` for new routes.
 */
export async function requireAdminOrg() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) {
    return { ok: false as const, status: 401 as const, supabase, user: null, orgId: null };
  }
  if (!authStateFromUser(userRes.user).isVerified) {
    return { ok: false as const, status: 403 as const, supabase, user: userRes.user, orgId: null };
  }
  const { data: row } = await supabase
    .from("organization_members")
    .select("org_id, role")
    .eq("user_id", userRes.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const membership = row as { org_id?: string; role?: string } | null;
  if (!membership?.org_id) {
    return { ok: false as const, status: 401 as const, supabase, user: userRes.user, orgId: null };
  }
  const role = parseOrgRole(membership.role ?? null);
  if (!isAdminLikeRole(role)) {
    return {
      ok: false as const,
      status: 403 as const,
      supabase,
      user: userRes.user,
      orgId: membership.org_id,
    };
  }
  return {
    ok: true as const,
    status: null,
    supabase,
    user: userRes.user,
    orgId: membership.org_id,
    role,
  };
}
