import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { trackServerAppEvent } from "@/lib/analytics/serverAppAnalytics";
import { phase2AnalyticsBase } from "@/modules/onboarding/phase2/phase2-analytics-payload";
import { getOrgOnboardingState } from "@/modules/onboarding/repositories/org-onboarding-states.repository";
import { requirePhase2OrgContext } from "../../_phase2Context";

export const runtime = "nodejs";

export async function POST() {
  const gate = await requirePhase2OrgContext();
  if (!gate.ok) return gate.response;
  const { supabase, userId, orgId } = gate.ctx;

  const { error } = await supabase.from("user_phase2_success_card_state").upsert(
    {
      user_id: userId,
      org_id: orgId,
      dismissed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,org_id" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const admin = createAdminClient();
  const { data: onboardRow } = await getOrgOnboardingState(admin, orgId);
  await trackServerAppEvent(admin, {
    orgId,
    userId,
    event: "onboarding_phase2_success_card_dismissed",
    properties: phase2AnalyticsBase(orgId, onboardRow?.phase2_status, onboardRow?.phase2_current_step),
  });

  return NextResponse.json({ ok: true });
}
