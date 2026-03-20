/**
 * Phase 10 — GET /api/onboarding/state (§18.1).
 */
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import {
  getOrgOnboardingState,
} from "@/modules/onboarding/repositories/org-onboarding-states.repository";
import {
  listOrgOnboardingSteps,
} from "@/modules/onboarding/repositories/org-onboarding-steps.repository";
import {
  listOrgOnboardingMilestones,
} from "@/modules/onboarding/repositories/org-onboarding-milestones.repository";
import {
  initializeOnboarding,
  evaluateOnboardingState,
} from "@/modules/onboarding/services/onboarding-engine.service";
import { evaluateSteps } from "@/modules/onboarding/services/onboarding-step-evaluator.service";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { activeOrgId } = await getActiveOrg(supabase, userRes.user.id);
  if (!activeOrgId) {
    return NextResponse.json({ error: "No active org" }, { status: 400 });
  }

  await initializeOnboarding(supabase, activeOrgId);
  await evaluateSteps(supabase, activeOrgId);
  await evaluateOnboardingState(supabase, activeOrgId);

  const { data: state } = await getOrgOnboardingState(supabase, activeOrgId);
  const { data: steps } = await listOrgOnboardingSteps(supabase, activeOrgId);
  const { data: milestones } = await listOrgOnboardingMilestones(supabase, activeOrgId);

  return NextResponse.json({
    onboardingState: state?.onboarding_state ?? "NOT_STARTED",
    firstValueReached: state?.first_value_reached ?? false,
    currentStepKey: state?.current_step_key ?? null,
    steps: steps?.map((s) => ({
      stepKey: s.stepKey,
      stepStatus: s.stepStatus,
      required: s.required,
      displayName: s.displayName,
      stepGroup: s.stepGroup,
    })) ?? [],
    milestones: milestones?.map((m) => ({
      milestoneKey: m.milestoneKey,
      reached: m.reached,
    })) ?? [],
  });
}
