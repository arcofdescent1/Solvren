/**
 * Guided Phase 1 — persist selected use cases (guided-owned).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { getOrgOnboardingState, upsertOrgOnboardingState } from "@/modules/onboarding/repositories/org-onboarding-states.repository";
import { ONBOARDING_USE_CASE_KEYS } from "@/modules/onboarding/domain/guided-phase1";

type Body = { useCases?: string[] };

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

  const keys = body.useCases ?? [];
  if (keys.length < 1) return NextResponse.json({ error: "at_least_one_use_case" }, { status: 400 });
  if (keys.length > 5) return NextResponse.json({ error: "at_most_five_use_cases" }, { status: 400 });

  const allowed = new Set(ONBOARDING_USE_CASE_KEYS);
  if (!keys.every((k) => allowed.has(k as (typeof ONBOARDING_USE_CASE_KEYS)[number]))) {
    return NextResponse.json({ error: "invalid_use_case_key" }, { status: 400 });
  }

  const { data: existing } = await getOrgOnboardingState(supabase, activeOrgId);
  if (!existing) return NextResponse.json({ error: "onboarding_not_initialized" }, { status: 400 });

  const { error } = await upsertOrgOnboardingState(supabase, {
    orgId: activeOrgId,
    selectedUseCases: keys,
    guidedCurrentStepKey: "baseline_scan",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, guidedCurrentStepKey: "baseline_scan" });
}
