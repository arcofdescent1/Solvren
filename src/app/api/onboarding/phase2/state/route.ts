import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDetectorConfig } from "@/modules/detection/persistence/detector-configs.repository";
import { getDetectorDefinitionByKey } from "@/modules/detection/persistence/detector-definitions.repository";
import { getOrgOnboardingState } from "@/modules/onboarding/repositories/org-onboarding-states.repository";
import { evaluatePhase2Milestones, syncPhase2ProgressToOrgState } from "@/modules/onboarding/phase2/phase2-milestones.service";
import {
  WORKFLOW_SOURCE_TEMPLATE_KEYS,
  WORKFLOW_TEMPLATE_TO_DETECTOR_KEY,
  type WorkflowSourceTemplateKey,
} from "@/modules/onboarding/phase2/workflow-templates";
import { trackServerAppEvent } from "@/lib/analytics/serverAppAnalytics";
import { phase2AnalyticsBase } from "@/modules/onboarding/phase2/phase2-analytics-payload";
import { ensurePhase2Started, requirePhase2OrgContext } from "../_phase2Context";

export const runtime = "nodejs";

export async function GET() {
  const gate = await requirePhase2OrgContext();
  if (!gate.ok) return gate.response;
  const { supabase, orgId, userId } = gate.ctx;
  const beforeStatus = gate.ctx.row?.phase2_status ?? null;
  let row = gate.ctx.row;
  row = await ensurePhase2Started(supabase, orgId, row);

  const admin = createAdminClient();
  if ((beforeStatus == null || beforeStatus === "NOT_STARTED") && row?.phase2_status === "IN_PROGRESS") {
    await trackServerAppEvent(admin, {
      orgId,
      userId,
      event: "onboarding_phase2_started",
      properties: phase2AnalyticsBase(orgId, row.phase2_status, row.phase2_current_step),
    });
  }

  await syncPhase2ProgressToOrgState(orgId);
  const { data: fresh } = await getOrgOnboardingState(admin, orgId);
  const flags = await evaluatePhase2Milestones(admin, orgId);

  const [{ data: riskRows }, { data: notifRows }, { data: slackInstall }] = await Promise.all([
    admin.from("org_risk_priorities").select("*").eq("org_id", orgId).order("priority_rank"),
    admin.from("org_notification_preferences").select("*").eq("org_id", orgId),
    admin.from("slack_installations").select("team_id, team_name, status").eq("org_id", orgId).maybeSingle(),
  ]);
  const slack = slackInstall as { team_id?: string; team_name?: string; status?: string } | null;
  const slackConnected = Boolean(slack?.team_id && (slack.status ?? "").toUpperCase() === "ACTIVE");

  const workflowStates: Record<string, { enabled: boolean; detectorKey: string }> = {};
  for (const key of WORKFLOW_SOURCE_TEMPLATE_KEYS) {
    const dk = WORKFLOW_TEMPLATE_TO_DETECTOR_KEY[key as WorkflowSourceTemplateKey];
    const { data: def } = await getDetectorDefinitionByKey(admin, dk);
    if (!def) {
      workflowStates[key] = { enabled: false, detectorKey: dk };
      continue;
    }
    const { data: cfg } = await getDetectorConfig(admin, orgId, def.id);
    workflowStates[key] = { enabled: Boolean(cfg?.enabled), detectorKey: dk };
  }

  return NextResponse.json({
    orgId,
    phase2Status: fresh?.phase2_status ?? row?.phase2_status ?? "IN_PROGRESS",
    phase2CurrentStep: fresh?.phase2_current_step ?? row?.phase2_current_step ?? "team_setup",
    phase2StartedAt: fresh?.phase2_started_at ?? row?.phase2_started_at ?? null,
    phase2CompletedAt: fresh?.phase2_completed_at ?? null,
    acceptedMemberCountExcludingOwner: fresh?.accepted_member_count_excluding_owner ?? 0,
    enabledWorkflowCount: fresh?.enabled_workflow_count ?? 0,
    configuredAlertChannelCount: fresh?.configured_alert_channel_count ?? 0,
    configuredApprovalRuleCount: fresh?.configured_approval_rule_count ?? 0,
    firstAlertDeliveredAt: fresh?.first_alert_delivered_at ?? null,
    firstOperationalEventAt: fresh?.first_operational_event_at ?? null,
    milestones: flags,
    riskPriorities: riskRows ?? [],
    notificationPreferences: notifRows ?? [],
    workflowStates,
    slack: {
      connected: slackConnected,
      teamId: slack?.team_id ?? null,
      teamName: slack?.team_name ?? null,
    },
  });
}
