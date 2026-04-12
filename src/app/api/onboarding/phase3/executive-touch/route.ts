import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { auditLog } from "@/lib/audit";
import { trackServerAppEvent } from "@/lib/analytics/serverAppAnalytics";
import { phase3AnalyticsBase } from "@/modules/onboarding/phase3/phase3-analytics-payload";
import { isExecutiveMembership } from "@/modules/onboarding/phase3/phase3-executive";
import { getOrgOnboardingState } from "@/modules/onboarding/repositories/org-onboarding-states.repository";
import { runPhase3Sync } from "@/modules/onboarding/phase3/phase3-sync.service";
import { requirePhase3OrgContext } from "../_phase3Context";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const gate = await requirePhase3OrgContext();
  if (!gate.ok) return gate.response;
  const { supabase, userId, orgId } = gate.ctx;

  let body: { path?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }
  const path = typeof body.path === "string" ? body.path.trim() : "";

  const { data: mem } = await supabase
    .from("organization_members")
    .select("role, department, title")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  const m = mem as { role?: string; department?: string; title?: string } | null;
  if (!m || !isExecutiveMembership({ role: m.role, department: m.department, title: m.title })) {
    return NextResponse.json({ ok: false, reason: "not_executive" }, { status: 200 });
  }

  const admin = createAdminClient();
  await auditLog(admin, {
    orgId,
    actorId: userId,
    actorType: "USER",
    action: "executive_dashboard_view",
    entityType: "executive_surface",
    entityId: null,
    metadata: { source: "phase3", path: path || undefined },
  });

  const { data: onboardRow } = await getOrgOnboardingState(admin, orgId);
  await trackServerAppEvent(admin, {
    orgId,
    userId,
    event: "onboarding_phase3_executive_engaged",
    properties: phase3AnalyticsBase(orgId, onboardRow?.phase3_status, onboardRow?.phase3_current_step),
  });

  await runPhase3Sync(orgId);

  return NextResponse.json({ ok: true });
}
