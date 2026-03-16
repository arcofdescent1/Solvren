import type { SupabaseClient } from "@supabase/supabase-js";
import { canRole, type Permission } from "./permissions";
import { parseOrgRole, type OrgRole } from "./roles";

export async function getUserOrgRole(
  supabase: SupabaseClient,
  userId: string,
  orgId: string
): Promise<OrgRole | null> {
  const { data } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  return parseOrgRole((data as { role?: string | null }).role ?? null);
}

export async function hasPermissionInOrg(
  supabase: SupabaseClient,
  userId: string,
  orgId: string,
  permission: Permission
): Promise<boolean> {
  const role = await getUserOrgRole(supabase, userId, orgId);
  if (!role) return false;
  return canRole(role, permission);
}

export function canViewChangeForRole(args: {
  role: OrgRole;
  status: string | null | undefined;
  createdBy: string | null | undefined;
  userId: string;
  isAssignedApprover: boolean;
}): boolean {
  const { role, status, createdBy, userId, isAssignedApprover } = args;
  const st = String(status ?? "");
  if (role === "OWNER" || role === "ADMIN") return true;
  if (role === "REVIEWER") return isAssignedApprover || st === "IN_REVIEW" || st === "APPROVED";
  if (role === "SUBMITTER")
    return createdBy === userId || isAssignedApprover || st === "APPROVED";
  return st === "APPROVED";
}
