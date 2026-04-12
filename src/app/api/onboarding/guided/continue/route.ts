/**
 * Guided Phase 1 — advance past welcome into setup (tracker-owned fields untouched).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { getOrgOnboardingState, upsertOrgOnboardingState } from "@/modules/onboarding/repositories/org-onboarding-states.repository";
import {
  hasQualifyingCrmOrPaymentConnection,
  listOnboardingIntegrationCards,
} from "@/modules/onboarding/services/guided-phase1-integrations";

type Body = { fromStep?: string };

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { activeOrgId } = await getActiveOrg(supabase, userRes.user.id);
  if (!activeOrgId) return NextResponse.json({ error: "No active org" }, { status: 400 });

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    body = {};
  }

  const { data: row } = await getOrgOnboardingState(supabase, activeOrgId);
  if (!row) return NextResponse.json({ error: "onboarding_not_initialized" }, { status: 400 });

  if (body.fromStep === "welcome") {
    const { error } = await upsertOrgOnboardingState(supabase, {
      orgId: activeOrgId,
      guidedPhase1Status: "IN_PROGRESS",
      guidedCurrentStepKey: "business_context",
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, guidedCurrentStepKey: "business_context" });
  }

  if (body.fromStep === "integrations") {
    const { cards, error: intErr } = await listOnboardingIntegrationCards(supabase, activeOrgId);
    if (intErr) return NextResponse.json({ error: intErr.message }, { status: 500 });
    if (!hasQualifyingCrmOrPaymentConnection(cards)) {
      return NextResponse.json({ error: "crm_or_payment_required" }, { status: 400 });
    }
    const { error } = await upsertOrgOnboardingState(supabase, {
      orgId: activeOrgId,
      guidedCurrentStepKey: "use_cases",
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, guidedCurrentStepKey: "use_cases" });
  }

  return NextResponse.json({ error: "unsupported_from_step" }, { status: 400 });
}
