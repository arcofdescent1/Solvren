/**
 * Phase 10 + Gap 5 + Guided Phase 1 — GET /api/onboarding/state (tracker + guided layers).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { getOrgOnboardingState } from "@/modules/onboarding/repositories/org-onboarding-states.repository";
import { listOrgOnboardingSteps } from "@/modules/onboarding/repositories/org-onboarding-steps.repository";
import { listOrgOnboardingMilestones } from "@/modules/onboarding/repositories/org-onboarding-milestones.repository";
import { evaluateAndUpdateOnboarding } from "@/modules/onboarding/services/onboarding-tracker.service";
import { getScanRunById } from "@/modules/onboarding/repositories/org-onboarding-scan-runs.repository";
import { tryProcessBaselineScanRun } from "@/modules/onboarding/services/onboarding-baseline-scan.service";
import {
  bootstrapGuidedPhase1IfNeeded,
  businessContextComplete,
  computeGuidedPercentComplete,
  computeGuidedSetupFlags,
  computeMaxAllowedGuidedStepIndex,
  resolveGuidedStepForRender,
  syncGuidedProgressToCanonicalSteps,
} from "@/modules/onboarding/services/guided-phase1-state.service";
import { GUIDED_STEP_ORDER } from "@/modules/onboarding/domain/guided-phase1";
import type { OrgOnboardingStateRow } from "@/modules/onboarding/repositories/org-onboarding-states.repository";

function parseStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string");
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { activeOrgId } = await getActiveOrg(supabase, userRes.user.id);
  if (!activeOrgId) {
    return NextResponse.json({ error: "No active org" }, { status: 400 });
  }

  const { progress } = await evaluateAndUpdateOnboarding(supabase, activeOrgId);

  let { data: state } = await getOrgOnboardingState(supabase, activeOrgId);
  await bootstrapGuidedPhase1IfNeeded(supabase, activeOrgId, state);
  ({ data: state } = await getOrgOnboardingState(supabase, activeOrgId));

  const flags = await computeGuidedSetupFlags(supabase, activeOrgId, state);
  if (state?.latest_baseline_scan_id) {
    const { data: scanRow } = await getScanRunById(supabase, state.latest_baseline_scan_id, activeOrgId);
    if (scanRow?.status === "QUEUED" || scanRow?.status === "RUNNING") {
      await tryProcessBaselineScanRun(state.latest_baseline_scan_id, activeOrgId);
      ({ data: state } = await getOrgOnboardingState(supabase, activeOrgId));
    }
  }

  await syncGuidedProgressToCanonicalSteps(supabase, activeOrgId, state);
  ({ data: state } = await getOrgOnboardingState(supabase, activeOrgId));

  const { data: steps } = await listOrgOnboardingSteps(supabase, activeOrgId);
  const { data: milestones } = await listOrgOnboardingMilestones(supabase, activeOrgId);

  const { data: orgRow } = await supabase.from("organizations").select("id, name").eq("id", activeOrgId).maybeSingle();

  const maxIdx = computeMaxAllowedGuidedStepIndex({
    row: state,
    guidedStatus: state?.guided_phase1_status,
    hasQualifyingIntegration: flags.hasQualifyingIntegration,
    useCasesChosen: flags.useCasesChosen,
    scanTerminal: flags.scanTerminal,
  });

  const queryStep = req.nextUrl.searchParams.get("step");
  const effectiveStep = resolveGuidedStepForRender({
    row: state,
    guidedStatus: state?.guided_phase1_status,
    maxIndex: maxIdx,
    queryStep,
  });

  const guidedPercentComplete = computeGuidedPercentComplete({
    row: state,
    hasQualifyingIntegration: flags.hasQualifyingIntegration,
    useCasesChosen: flags.useCasesChosen,
    scanTerminal: flags.scanTerminal,
    resultsViewed: !!state?.results_screen_viewed_at,
    guidedStatus: state?.guided_phase1_status,
  });

  const baselineScan =
    state?.latest_baseline_scan_id && flags.latestScanStatus
      ? {
          id: state.latest_baseline_scan_id,
          status: flags.latestScanStatus,
          issueCount: null as number | null,
          estimatedRevenueAtRisk: null as number | null,
          findings: null as Record<string, unknown> | null,
        }
      : null;

  if (state?.latest_baseline_scan_id) {
    const { data: scan } = await getScanRunById(supabase, state.latest_baseline_scan_id, activeOrgId);
    if (scan && baselineScan) {
      baselineScan.status = scan.status;
      baselineScan.issueCount = scan.issue_count;
      baselineScan.estimatedRevenueAtRisk =
        scan.estimated_revenue_at_risk != null ? Number(scan.estimated_revenue_at_risk) : null;
      baselineScan.findings = (scan.findings as Record<string, unknown> | null) ?? null;
    }
  }

  const tracker = {
    onboardingState: state?.onboarding_state ?? "NOT_STARTED",
    onboardingStage: progress.stage,
    percentComplete: progress.percentComplete,
    firstValueReached: state?.first_value_reached ?? false,
    firstValueAt: state?.first_value_at ?? null,
    activatedAt: state?.activated_at ?? null,
    currentStepKey: state?.current_step_key ?? null,
    integrationsConnected: progress.integrationsConnected,
    firstSignalReceived: progress.firstSignalReceived,
    firstIssueDetected: progress.firstIssueDetected,
    firstActionExecuted: progress.firstActionExecuted,
    firstValueVerified: progress.firstValueVerified,
  };

  const guided = {
    flowVersion: state?.guided_flow_version ?? null,
    status: state?.guided_phase1_status ?? null,
    currentStepKey: state?.guided_current_step_key ?? null,
    effectiveStepKey: effectiveStep,
    maxAllowedStepKey: GUIDED_STEP_ORDER[maxIdx] ?? "welcome",
    guidedPercentComplete,
    companySize: state?.company_size ?? null,
    industry: state?.industry ?? null,
    primaryGoal: state?.primary_goal ?? null,
    selectedUseCases: parseStringArray(state?.selected_use_cases),
    latestBaselineScanId: state?.latest_baseline_scan_id ?? null,
    firstInsightSummary: state?.first_insight_summary ?? null,
    resultsScreenViewedAt: state?.results_screen_viewed_at ?? null,
    businessContextComplete: businessContextComplete(state ?? ({} as OrgOnboardingStateRow)),
    hasQualifyingCrmOrPayment: flags.hasQualifyingIntegration,
    baselineScan,
  };

  return NextResponse.json({
    tracker,
    guided,
    organization: orgRow ? { id: String((orgRow as { id: string }).id), name: (orgRow as { name?: string | null }).name ?? "" } : { id: activeOrgId, name: "" },
    onboardingState: tracker.onboardingState,
    firstValueReached: tracker.firstValueReached,
    currentStepKey: tracker.currentStepKey,
    integrationsConnected: tracker.integrationsConnected,
    firstSignalReceived: tracker.firstSignalReceived,
    firstIssueDetected: tracker.firstIssueDetected,
    firstActionExecuted: tracker.firstActionExecuted,
    firstValueVerified: tracker.firstValueVerified,
    stage: tracker.onboardingStage,
    percentComplete: tracker.percentComplete,
    guidedPercentComplete,
    steps:
      steps?.map((s) => ({
        stepKey: s.stepKey,
        stepStatus: s.stepStatus,
        required: s.required,
        displayName: s.displayName,
        stepGroup: s.stepGroup,
      })) ?? [],
    milestones:
      milestones?.map((m) => ({
        milestoneKey: m.milestoneKey,
        reached: m.reached,
      })) ?? [],
  });
}
