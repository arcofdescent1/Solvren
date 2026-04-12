import { NextRequest, NextResponse } from "next/server";
import { auditLog } from "@/lib/audit";
import { trackServerAppEvent } from "@/lib/analytics/serverAppAnalytics";
import { createAdminClient } from "@/lib/supabase/admin";
import { phase3AnalyticsBase } from "@/modules/onboarding/phase3/phase3-analytics-payload";
import { isPhase3QualifyingInteractionType } from "@/modules/onboarding/phase3/phase3-interaction-types";
import { getOrgOnboardingState } from "@/modules/onboarding/repositories/org-onboarding-states.repository";
import { runPhase3Sync } from "@/modules/onboarding/phase3/phase3-sync.service";
import { requirePhase3OrgContext } from "../_phase3Context";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const gate = await requirePhase3OrgContext();
  if (!gate.ok) return gate.response;
  const { supabase, userId, orgId } = gate.ctx;

  let body: { type?: string; refType?: string | null; refId?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const type = typeof body.type === "string" ? body.type.trim() : "";
  if (!isPhase3QualifyingInteractionType(type)) {
    return NextResponse.json({ error: "invalid_interaction_type" }, { status: 400 });
  }

  const refType = typeof body.refType === "string" && body.refType.trim() ? body.refType.trim() : null;
  const rawRefId = typeof body.refId === "string" && body.refId.trim() ? body.refId.trim() : null;
  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const refId = rawRefId && uuidRe.test(rawRefId) ? rawRefId : null;

  const { error: insErr } = await supabase.from("org_phase3_usage_interactions").insert({
    org_id: orgId,
    user_id: userId,
    interaction_type: type,
    ref_type: refType,
    ref_id: refId,
  });

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  const admin = createAdminClient();
  await auditLog(admin, {
    orgId,
    actorId: userId,
    actorType: "USER",
    action: "onboarding_phase3_interaction_recorded",
    entityType: "org_phase3_usage_interactions",
    entityId: null,
    metadata: { source: "phase3", interactionType: type, refType, refId },
  });

  const { data: onboardRow } = await getOrgOnboardingState(admin, orgId);
  await trackServerAppEvent(admin, {
    orgId,
    userId,
    event: "onboarding_phase3_habit_progress_updated",
    properties: {
      ...phase3AnalyticsBase(orgId, onboardRow?.phase3_status, onboardRow?.phase3_current_step),
      interactionType: type,
    },
  });

  await runPhase3Sync(orgId);

  return NextResponse.json({ ok: true });
}
