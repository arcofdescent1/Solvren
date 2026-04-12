import { NextRequest, NextResponse } from "next/server";
import { auditLog } from "@/lib/audit";
import { trackServerAppEvent } from "@/lib/analytics/serverAppAnalytics";
import { createAdminClient } from "@/lib/supabase/admin";
import { phase4AnalyticsBase } from "@/modules/onboarding/phase4/phase4-analytics-payload";
import { getOrgOnboardingState } from "@/modules/onboarding/repositories/org-onboarding-states.repository";
import { runPhase4Sync } from "@/modules/onboarding/phase4/phase4-sync.service";
import { isAdminLikeRole } from "@/lib/rbac/roles";
import { requirePhase4OrgContext } from "../_phase4Context";

export const runtime = "nodejs";

const BU_TYPES = new Set(["BUSINESS_UNIT", "REGION", "SUBSIDIARY", "DIVISION"]);

export async function POST(req: NextRequest) {
  const gate = await requirePhase4OrgContext();
  if (!gate.ok) return gate.response;
  const { supabase, orgId, userId, orgRole } = gate.ctx;
  if (!isAdminLikeRole(orgRole)) {
    return NextResponse.json({ error: "admin_required" }, { status: 403 });
  }

  let body: { name?: string; type?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const type = typeof body.type === "string" ? body.type.trim().toUpperCase() : "";
  if (!name || !BU_TYPES.has(type)) {
    return NextResponse.json({ error: "invalid_business_unit" }, { status: 400 });
  }

  const { data: ins, error } = await supabase
    .from("org_business_units")
    .insert({ org_id: orgId, name, type })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const admin = createAdminClient();
  await auditLog(admin, {
    orgId,
    actorId: userId,
    actorType: "USER",
    action: "onboarding_phase4_business_unit_added",
    entityType: "org_business_units",
    entityId: (ins as { id: string }).id,
    metadata: { name, type },
  });

  const { data: onboardRow } = await getOrgOnboardingState(admin, orgId);
  await trackServerAppEvent(admin, {
    orgId,
    userId,
    event: "onboarding_phase4_business_unit_added",
    properties: {
      ...phase4AnalyticsBase(orgId, onboardRow?.phase4_status, onboardRow?.phase4_current_step),
      businessUnitId: (ins as { id: string }).id,
    },
  });

  await runPhase4Sync(orgId);
  return NextResponse.json({ ok: true, id: (ins as { id: string }).id });
}
