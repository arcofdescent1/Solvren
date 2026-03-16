import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const COOKIE_NAME = "rg_active_org";

export type OrgMembership = {
  orgId: string;
  orgName: string | null;
  role: string | null;
};

/**
 * Returns the active org for the current user.
 *
 * Strategy:
 * 1) If cookie rg_active_org is set and user is a member, use it.
 * 2) Otherwise fall back to the earliest membership.
 */
export async function getActiveOrg(
  supabase: SupabaseClient,
  userId: string
): Promise<{ activeOrgId: string | null; memberships: OrgMembership[] }> {
  const cookieStore = await cookies();
  const cookieOrgId = cookieStore.get(COOKIE_NAME)?.value ?? null;

  const { data: memberships, error: memErr } = await supabase
    .from("organization_members")
    .select("org_id, role, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (memErr) throw new Error(memErr.message);

  const orgIds = (memberships ?? []).map((m) => String(m.org_id));

  const { data: orgs, error: orgErr } = await supabase
    .from("organizations")
    .select("id, name")
    .in("id", orgIds);

  if (orgErr) throw new Error(orgErr.message);

  const nameById = new Map<string, string | null>();
  for (const o of orgs ?? []) {
    nameById.set(
      String((o as { id?: string }).id ?? ""),
      (o as { name?: string | null }).name ?? null
    );
  }

  const list: OrgMembership[] = (memberships ?? []).map((m) => {
    const id = String((m as { org_id?: string }).org_id ?? "");
    return {
      orgId: id,
      orgName: nameById.get(id) ?? null,
      role: (m as { role?: string | null }).role ?? null,
    };
  });

  let activeOrgId: string | null = null;
  if (cookieOrgId && orgIds.includes(cookieOrgId)) {
    activeOrgId = cookieOrgId;
  } else if (orgIds.length > 0) {
    activeOrgId = orgIds[0];
  }

  return { activeOrgId, memberships: list };
}

export function getActiveOrgCookieName() {
  return COOKIE_NAME;
}
