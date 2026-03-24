import type { SupabaseClient } from "@supabase/supabase-js";
import { AuthzError, requireVerifiedUser } from "@/lib/server/authz";
import { hasPermissionInOrg } from "@/lib/rbac/can";

/**
 * After an org is purged, the user may no longer be an org member. Allow read access to purge runs
 * if they participated in the request or still have domains.manage on the org when it exists.
 */
export async function requireOrgPurgeRunAccess(input: {
  supabase: SupabaseClient;
  admin: SupabaseClient;
  requestId: string;
  targetOrgId: string;
}): Promise<{ userId: string }> {
  const session = await requireVerifiedUser();
  const userId = session.user.id;

  const { data: req, error } = await input.admin
    .from("org_purge_requests")
    .select("requested_by_user_id, approved_by_user_id")
    .eq("id", input.requestId)
    .maybeSingle();
  if (error || !req) throw new AuthzError(404, "Purge request not found");

  const r = req as { requested_by_user_id: string; approved_by_user_id: string | null };
  if (r.requested_by_user_id === userId || r.approved_by_user_id === userId) {
    return { userId };
  }

  const okManage = await hasPermissionInOrg(input.supabase, userId, input.targetOrgId, "domains.manage");
  if (okManage) return { userId };

  throw new AuthzError(403, "Forbidden");
}
