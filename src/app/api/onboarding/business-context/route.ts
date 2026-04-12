/**
 * Guided Phase 1 — save business context (guided-owned columns only).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { getOrgOnboardingState, upsertOrgOnboardingState } from "@/modules/onboarding/repositories/org-onboarding-states.repository";
import {
  COMPANY_SIZES,
  INDUSTRIES,
  PRIMARY_GOALS,
} from "@/modules/onboarding/domain/guided-phase1";

type Body = {
  companySize?: string;
  industry?: string;
  primaryGoal?: string;
};

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { activeOrgId } = await getActiveOrg(supabase, userRes.user.id);
  if (!activeOrgId) return NextResponse.json({ error: "No active org" }, { status: 400 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.companySize || !body.industry || !body.primaryGoal) {
    return NextResponse.json({ error: "companySize, industry, and primaryGoal are required" }, { status: 400 });
  }

  if (!COMPANY_SIZES.includes(body.companySize as (typeof COMPANY_SIZES)[number])) {
    return NextResponse.json({ error: "invalid_company_size" }, { status: 400 });
  }
  if (!INDUSTRIES.includes(body.industry as (typeof INDUSTRIES)[number])) {
    return NextResponse.json({ error: "invalid_industry" }, { status: 400 });
  }
  if (!PRIMARY_GOALS.includes(body.primaryGoal as (typeof PRIMARY_GOALS)[number])) {
    return NextResponse.json({ error: "invalid_primary_goal" }, { status: 400 });
  }

  const { data: existing } = await getOrgOnboardingState(supabase, activeOrgId);
  if (!existing) return NextResponse.json({ error: "onboarding_not_initialized" }, { status: 400 });

  const { error } = await upsertOrgOnboardingState(supabase, {
    orgId: activeOrgId,
    companySize: body.companySize,
    industry: body.industry,
    primaryGoal: body.primaryGoal,
    guidedPhase1Status: existing.guided_phase1_status === "NOT_STARTED" ? "IN_PROGRESS" : existing.guided_phase1_status ?? "IN_PROGRESS",
    guidedCurrentStepKey: "integrations",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, guidedCurrentStepKey: "integrations" });
}
