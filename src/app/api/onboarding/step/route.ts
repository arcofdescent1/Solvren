/**
 * Phase 10 — PUT /api/onboarding/step (update step).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { updateOrgOnboardingStep } from "@/modules/onboarding/repositories/org-onboarding-steps.repository";
import { upsertOrgOnboardingState } from "@/modules/onboarding/repositories/org-onboarding-states.repository";
import { evaluateOnboardingState } from "@/modules/onboarding/services/onboarding-engine.service";

type Body = {
  stepKey: string;
  stepStatus?: "IN_PROGRESS" | "COMPLETED" | "SKIPPED";
};

export async function PUT(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { activeOrgId } = await getActiveOrg(supabase, userRes.user.id);
  if (!activeOrgId) {
    return NextResponse.json({ error: "No active org" }, { status: 400 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.stepKey) {
    return NextResponse.json({ error: "stepKey required" }, { status: 400 });
  }

  const updates: Parameters<typeof updateOrgOnboardingStep>[3] = {};
  if (body.stepStatus === "COMPLETED") {
    updates.stepStatus = "COMPLETED";
    updates.completedAt = new Date().toISOString();
  }
  if (body.stepStatus === "IN_PROGRESS") {
    updates.stepStatus = "IN_PROGRESS";
    await upsertOrgOnboardingState(supabase, { orgId: activeOrgId, currentStepKey: body.stepKey });
  }
  if (body.stepStatus === "SKIPPED") {
    updates.stepStatus = "SKIPPED";
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "stepStatus required" }, { status: 400 });
  }

  const { error } = await updateOrgOnboardingStep(supabase, activeOrgId, body.stepKey, updates);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await evaluateOnboardingState(supabase, activeOrgId);

  return NextResponse.json({ ok: true });
}
