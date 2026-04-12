import { NextResponse } from "next/server";
import { auditLog } from "@/lib/audit";
import { trackServerAppEvent } from "@/lib/analytics/serverAppAnalytics";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { phase4AnalyticsBase } from "@/modules/onboarding/phase4/phase4-analytics-payload";
import { getOrgOnboardingState } from "@/modules/onboarding/repositories/org-onboarding-states.repository";
import { runPhase4Sync } from "@/modules/onboarding/phase4/phase4-sync.service";
import { isAdminLikeRole } from "@/lib/rbac/roles";
import { requirePhase4OrgContext } from "../../_phase4Context";

export const runtime = "nodejs";

export async function POST() {
  const gate = await requirePhase4OrgContext();
  if (!gate.ok) return gate.response;
  const { orgId, userId, orgRole } = gate.ctx;
  if (!isAdminLikeRole(orgRole)) {
    return NextResponse.json({ error: "admin_required" }, { status: 403 });
  }

  const session = await createServerSupabaseClient();
  const { data: userRes } = await session.auth.getUser();
  const requestingUserId = userRes?.user?.id ?? null;

  const end = new Date();
  const start = new Date(end.getTime() - 6 * 86400000);
  const periodStart = start.toISOString().slice(0, 10);
  const periodEnd = end.toISOString().slice(0, 10);

  const admin = createAdminClient();
  const { data: gr, error: grErr } = await admin
    .from("generated_reports")
    .insert({
      org_id: orgId,
      report_type: "MONTHLY_EXEC_SUMMARY",
      period_start: periodStart,
      period_end: periodEnd,
      status: "QUEUED",
      requesting_user_id: requestingUserId,
    })
    .select("id")
    .single();
  if (grErr) return NextResponse.json({ error: grErr.message }, { status: 500 });

  const reportId = (gr as { id: string }).id;

  const { data: wrap, error: wrapErr } = await admin
    .from("org_qbr_reports")
    .insert({
      org_id: orgId,
      report_type: "WEEKLY_EXECUTIVE_SUMMARY",
      period_start: periodStart,
      period_end: periodEnd,
      generated_report_id: reportId,
      metrics: {},
    })
    .select("id")
    .single();
  if (wrapErr) return NextResponse.json({ error: wrapErr.message }, { status: 500 });

  await auditLog(admin, {
    orgId,
    actorId: userId,
    actorType: "USER",
    action: "onboarding_phase4_qbr_generated",
    entityType: "org_qbr_reports",
    entityId: (wrap as { id: string }).id,
    metadata: { generatedReportId: reportId },
  });

  const { data: onboardRow } = await getOrgOnboardingState(admin, orgId);
  await trackServerAppEvent(admin, {
    orgId,
    userId,
    event: "onboarding_phase4_qbr_generated",
    properties: {
      ...phase4AnalyticsBase(orgId, onboardRow?.phase4_status, onboardRow?.phase4_current_step),
      orgQbrReportId: (wrap as { id: string }).id,
      generatedReportId: reportId,
    },
  });

  await runPhase4Sync(orgId);
  return NextResponse.json({
    ok: true,
    generatedReportId: reportId,
    orgQbrReportId: (wrap as { id: string }).id,
  });
}
