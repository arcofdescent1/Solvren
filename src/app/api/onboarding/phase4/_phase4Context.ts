import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { authStateFromUser, requireVerifiedResponse } from "@/lib/auth";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { getOrgOnboardingState } from "@/modules/onboarding/repositories/org-onboarding-states.repository";
import type { OrgOnboardingStateRow } from "@/modules/onboarding/repositories/org-onboarding-states.repository";
import { parseOrgRole, type OrgRole } from "@/lib/rbac/roles";

export type Phase4RequestContext = {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  userId: string;
  userEmail: string | undefined;
  orgId: string;
  row: OrgOnboardingStateRow | null;
  orgRole: OrgRole;
};

export async function requirePhase4OrgContext(): Promise<
  { ok: true; ctx: Phase4RequestContext } | { ok: false; response: NextResponse }
> {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const forbidden = requireVerifiedResponse(authStateFromUser(userRes.user));
  if (forbidden) return { ok: false, response: forbidden };

  const { activeOrgId } = await getActiveOrg(supabase, userRes.user.id);
  if (!activeOrgId) {
    return { ok: false, response: NextResponse.json({ error: "No organization" }, { status: 400 }) };
  }

  const { data: row } = await getOrgOnboardingState(supabase, activeOrgId);
  if (row?.phase3_status !== "COMPLETED") {
    return { ok: false, response: NextResponse.json({ error: "phase4_requires_phase3_complete" }, { status: 403 }) };
  }

  const { data: mem } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", activeOrgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();
  const orgRole = parseOrgRole((mem as { role?: string | null } | null)?.role ?? null);

  return {
    ok: true,
    ctx: {
      supabase,
      userId: userRes.user.id,
      userEmail: userRes.user.email ?? undefined,
      orgId: activeOrgId,
      row,
      orgRole,
    },
  };
}
