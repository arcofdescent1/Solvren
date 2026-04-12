/**
 * Guided Phase 1 — mark guided flow complete after results (does not touch tracker first_value flags).
 */
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { getOrgOnboardingState, upsertOrgOnboardingState } from "@/modules/onboarding/repositories/org-onboarding-states.repository";

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { activeOrgId } = await getActiveOrg(supabase, userRes.user.id);
  if (!activeOrgId) return NextResponse.json({ error: "No active org" }, { status: 400 });

  const { data: row } = await getOrgOnboardingState(supabase, activeOrgId);
  if (!row) return NextResponse.json({ error: "onboarding_not_initialized" }, { status: 400 });

  const now = new Date().toISOString();
  const { error } = await upsertOrgOnboardingState(supabase, {
    orgId: activeOrgId,
    guidedPhase1Status: "COMPLETED",
    resultsScreenViewedAt: now,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, guidedPhase1Status: "COMPLETED" });
}
