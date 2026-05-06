import type { SupabaseClient } from "@supabase/supabase-js";
import { isExecutiveUserForPhase1 } from "@/lib/rbac/isExecutiveUserForPhase1";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";

/**
 * Phase 4 — /roi and value-delivered API: Admin, Executive, not basic-only users.
 */
export async function canViewRoiDashboard(
  supabase: SupabaseClient,
  userId: string,
  orgId: string
): Promise<boolean> {
  const { data: mem } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!mem) return false;
  const role = parseOrgRole((mem as { role?: string | null }).role ?? null);
  if (isAdminLikeRole(role)) return true;
  return isExecutiveUserForPhase1(supabase, userId, orgId);
}
