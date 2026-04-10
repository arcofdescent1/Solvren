import type { SupabaseClient } from "@supabase/supabase-js";
import { parseOrgRole } from "./roles";

const EXECUTIVE_ROLE_KEYS = new Set([
  "EXEC",
  "CEO",
  "COO",
  "CRO",
  "VP_TECH",
  "DEPARTMENT_LEADER",
]);

/**
 * Phase 1 executive gate: OWNER/ADMIN org role, or org_member_roles.role_key in executive list.
 */
export async function isExecutiveUserForPhase1(
  supabase: SupabaseClient,
  userId: string,
  orgId: string
): Promise<boolean> {
  const { data: member, error: mErr } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  if (mErr || !member) return false;

  const role = parseOrgRole((member as { role?: string | null }).role ?? null);
  if (role === "OWNER" || role === "ADMIN") return true;

  const { data: keys, error: rErr } = await supabase
    .from("organization_member_roles")
    .select("role_key")
    .eq("org_id", orgId)
    .eq("user_id", userId);

  if (rErr || !keys?.length) return false;

  return keys.some((row) =>
    EXECUTIVE_ROLE_KEYS.has(String((row as { role_key?: string }).role_key ?? "").toUpperCase())
  );
}
