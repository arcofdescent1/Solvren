import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { trackServerAppEvent } from "@/lib/analytics/serverAppAnalytics";
import { getOrgOnboardingState } from "@/modules/onboarding/repositories/org-onboarding-states.repository";
import { meetsPhase3EntryConditions } from "@/modules/onboarding/phase3/phase3-entry.service";
import { phase3AnalyticsBase } from "@/modules/onboarding/phase3/phase3-analytics-payload";
import { runPhase3Sync, readCachedMilestoneFlagsFromRow } from "@/modules/onboarding/phase3/phase3-sync.service";
import { requirePhase3OrgContext } from "../_phase3Context";

export const runtime = "nodejs";

export async function GET() {
  const gate = await requirePhase3OrgContext();
  if (!gate.ok) return gate.response;
  const { orgId, userId, row } = gate.ctx;

  const admin = createAdminClient();
  const beforeStatus = row?.phase3_status ?? null;
  const { error } = await runPhase3Sync(orgId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: fresh } = await getOrgOnboardingState(admin, orgId);
  const eligible = await meetsPhase3EntryConditions(admin, orgId, fresh);

  if ((beforeStatus == null || beforeStatus === "NOT_STARTED") && fresh?.phase3_status === "IN_PROGRESS") {
    await trackServerAppEvent(admin, {
      orgId,
      userId,
      event: "onboarding_phase3_started",
      properties: phase3AnalyticsBase(orgId, fresh?.phase3_status, fresh?.phase3_current_step),
    });
  }

  const cachedFlags = fresh
    ? readCachedMilestoneFlagsFromRow(fresh)
    : row
      ? readCachedMilestoneFlagsFromRow(row)
      : {
          expansionOk: false,
          deptOk: false,
          execOk: false,
          valueOk: false,
          habitOk: false,
          allComplete: false,
        };

  const { data: mems } = await admin
    .from("organization_members")
    .select("department")
    .eq("org_id", orgId);
  const departmentMemberCounts: Record<string, number> = {};
  for (const m of mems ?? []) {
    const d = String((m as { department?: string | null }).department ?? "").trim();
    if (!d) continue;
    departmentMemberCounts[d] = (departmentMemberCounts[d] ?? 0) + 1;
  }

  return NextResponse.json({
    orgId,
    eligible,
    phase3Status: fresh?.phase3_status ?? row?.phase3_status ?? "NOT_STARTED",
    phase3CurrentStep: fresh?.phase3_current_step ?? row?.phase3_current_step ?? "expand_coverage",
    phase3StartedAt: fresh?.phase3_started_at ?? null,
    phase3CompletedAt: fresh?.phase3_completed_at ?? null,
    expandedIntegrationCount: fresh?.expanded_integration_count ?? 0,
    activeDepartmentCount: fresh?.active_department_count ?? 0,
    executiveEngagementAt: fresh?.executive_engagement_at ?? null,
    executiveEngagedUserId: fresh?.executive_engaged_user_id ?? null,
    firstValueStoryId: fresh?.first_value_story_id ?? null,
    phase3ActiveWeeks: fresh?.phase3_active_weeks ?? 0,
    phase3UsageInteractionCount: fresh?.phase3_usage_interaction_count ?? 0,
    phase3BaselineConnectedIntegrations: fresh?.phase3_baseline_connected_integrations ?? 0,
    phase3BaselineEnabledWorkflows: fresh?.phase3_baseline_enabled_workflows ?? 0,
    milestones: cachedFlags,
    departmentMemberCounts,
  });
}
