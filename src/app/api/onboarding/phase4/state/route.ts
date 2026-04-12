import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { trackServerAppEvent } from "@/lib/analytics/serverAppAnalytics";
import { getOrgOnboardingState } from "@/modules/onboarding/repositories/org-onboarding-states.repository";
import { meetsPhase4EntryConditions } from "@/modules/onboarding/phase4/phase4-entry.service";
import { phase4AnalyticsBase } from "@/modules/onboarding/phase4/phase4-analytics-payload";
import {
  runPhase4Sync,
  computePhase4MilestoneFlags,
} from "@/modules/onboarding/phase4/phase4-sync.service";
import { planFromString } from "@/services/billing/entitlements";
import { phase4Thresholds } from "@/modules/onboarding/phase4/phase4-thresholds";
import { requirePhase4OrgContext } from "../_phase4Context";

export const runtime = "nodejs";

export async function GET() {
  const gate = await requirePhase4OrgContext();
  if (!gate.ok) return gate.response;
  const { orgId, userId, row } = gate.ctx;

  const admin = createAdminClient();
  const beforeStatus = row?.phase4_status ?? null;
  const { error } = await runPhase4Sync(orgId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: fresh } = await getOrgOnboardingState(admin, orgId);
  const eligible = await meetsPhase4EntryConditions(admin, orgId, fresh);

  const { data: billing } = await admin.from("billing_accounts").select("plan_key").eq("org_id", orgId).maybeSingle();
  const plan = planFromString((billing as { plan_key?: string } | null)?.plan_key);
  const thresholds = phase4Thresholds(plan);

  if ((beforeStatus == null || beforeStatus === "NOT_STARTED") && fresh?.phase4_status === "IN_PROGRESS") {
    await trackServerAppEvent(admin, {
      orgId,
      userId,
      event: "onboarding_phase4_started",
      properties: phase4AnalyticsBase(orgId, fresh?.phase4_status, fresh?.phase4_current_step),
    });
  }

  const milestones = computePhase4MilestoneFlags(fresh ?? row, plan);

  return NextResponse.json({
    orgId,
    eligible,
    planTier: plan,
    thresholds,
    phase4Status: fresh?.phase4_status ?? row?.phase4_status ?? "NOT_STARTED",
    phase4CurrentStep: fresh?.phase4_current_step ?? row?.phase4_current_step ?? "expand_org_footprint",
    phase4StartedAt: fresh?.phase4_started_at ?? null,
    phase4CompletedAt: fresh?.phase4_completed_at ?? null,
    phase4ExpandedUnitCount: fresh?.phase4_expanded_unit_count ?? 0,
    phase4ConnectedIntegrations: fresh?.phase4_connected_integrations ?? 0,
    phase4EnabledWorkflows: fresh?.phase4_enabled_workflows ?? 0,
    phase4ConsecutiveExecutiveWeeks: fresh?.phase4_consecutive_executive_weeks ?? 0,
    phase4SystemOfRecordConfirmed: fresh?.phase4_system_of_record_confirmed ?? false,
    phase4RenewalScore: fresh?.phase4_renewal_score ?? 0,
    phase4ExpansionRecommendationCount: fresh?.phase4_expansion_recommendation_count ?? 0,
    phase4BaselineBusinessUnitCount: fresh?.phase4_baseline_business_unit_count ?? 0,
    milestones,
  });
}
