import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { authStateFromUser, requireVerifiedResponse } from "@/lib/auth";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { getOrgOnboardingState, upsertOrgOnboardingState } from "@/modules/onboarding/repositories/org-onboarding-states.repository";
import { meetsPhase2TechnicalPrerequisites } from "@/modules/onboarding/phase2/phase2-entry.service";
import type { OrgOnboardingStateRow } from "@/modules/onboarding/repositories/org-onboarding-states.repository";

export type Phase2RequestContext = {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  userId: string;
  userEmail: string | undefined;
  orgId: string;
  row: OrgOnboardingStateRow | null;
};

export async function requirePhase2OrgContext(): Promise<
  | { ok: true; ctx: Phase2RequestContext }
  | { ok: false; response: NextResponse }
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
  if (!(await meetsPhase2TechnicalPrerequisites(supabase, activeOrgId, row))) {
    return {
      ok: false,
      response: NextResponse.json({ error: "phase2_prerequisites_not_met" }, { status: 403 }),
    };
  }

  return {
    ok: true,
    ctx: {
      supabase,
      userId: userRes.user.id,
      userEmail: userRes.user.email ?? undefined,
      orgId: activeOrgId,
      row,
    },
  };
}

/** First successful GET of Phase 2 state starts the activation journey. */
export async function ensurePhase2Started(
  supabase: Phase2RequestContext["supabase"],
  orgId: string,
  row: OrgOnboardingStateRow | null
): Promise<OrgOnboardingStateRow | null> {
  const s = row?.phase2_status;
  if (!row || s == null || s === "NOT_STARTED") {
    const startedAt = row?.phase2_started_at ?? new Date().toISOString();
    await upsertOrgOnboardingState(supabase, {
      orgId,
      phase2Status: "IN_PROGRESS",
      phase2CurrentStep: row?.phase2_current_step ?? "team_setup",
      phase2StartedAt: startedAt,
    });
    const { data: next } = await getOrgOnboardingState(supabase, orgId);
    return next;
  }
  return row;
}
