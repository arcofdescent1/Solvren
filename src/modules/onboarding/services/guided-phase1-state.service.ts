/**
 * Guided Phase 1 — UI progression, percent complete, and step clamping (tracker stays authoritative).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { GUIDED_FLOW_VERSION, GUIDED_STEP_ORDER, type GuidedPhase1Status, type GuidedStepKey } from "../domain/guided-phase1";
import type { OrgOnboardingStateRow } from "../repositories/org-onboarding-states.repository";
import { upsertOrgOnboardingState } from "../repositories/org-onboarding-states.repository";
import { getScanRunById } from "../repositories/org-onboarding-scan-runs.repository";
import { hasQualifyingCrmOrPaymentConnection, listOnboardingIntegrationCards } from "./guided-phase1-integrations";
import { markStepCompleted } from "./onboarding-engine.service";

function parseUseCases(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string");
}

export function isGuidedPhase1Finished(status: string | null | undefined): boolean {
  return status === "COMPLETED" || status === "SKIPPED";
}

export function businessContextComplete(row: OrgOnboardingStateRow): boolean {
  return !!(row.company_size && row.industry && row.primary_goal);
}

export async function bootstrapGuidedPhase1IfNeeded(
  supabase: SupabaseClient,
  orgId: string,
  row: OrgOnboardingStateRow | null
): Promise<{ error: Error | null }> {
  if (!row) return { error: null };
  if (row.guided_phase1_status != null) return { error: null };
  return upsertOrgOnboardingState(supabase, {
    orgId,
    guidedFlowVersion: GUIDED_FLOW_VERSION,
    guidedPhase1Status: "NOT_STARTED",
    guidedCurrentStepKey: "welcome",
  });
}


export async function computeGuidedSetupFlags(
  supabase: SupabaseClient,
  orgId: string,
  row: OrgOnboardingStateRow | null
): Promise<{
  hasQualifyingIntegration: boolean;
  useCasesChosen: boolean;
  scanTerminal: "none" | "queued" | "running" | "completed" | "failed";
  latestScanStatus: string | null;
}> {
  const { cards } = await listOnboardingIntegrationCards(supabase, orgId);
  const hasQualifyingIntegration = hasQualifyingCrmOrPaymentConnection(cards);
  const useCasesChosen = parseUseCases(row?.selected_use_cases).length > 0;

  let scanTerminal: "none" | "queued" | "running" | "completed" | "failed" = "none";
  let latestScanStatus: string | null = null;
  const scanId = row?.latest_baseline_scan_id;
  if (scanId) {
    const { data: run } = await getScanRunById(supabase, scanId, orgId);
    latestScanStatus = run?.status ?? null;
    if (run?.status === "QUEUED") scanTerminal = "queued";
    else if (run?.status === "RUNNING") scanTerminal = "running";
    else if (run?.status === "COMPLETED") scanTerminal = "completed";
    else if (run?.status === "FAILED") scanTerminal = "failed";
  }

  return { hasQualifyingIntegration, useCasesChosen, scanTerminal, latestScanStatus };
}

export function computeMaxAllowedGuidedStepIndex(args: {
  row: OrgOnboardingStateRow | null;
  guidedStatus: GuidedPhase1Status | string | null | undefined;
  hasQualifyingIntegration: boolean;
  useCasesChosen: boolean;
  scanTerminal: "none" | "queued" | "running" | "completed" | "failed";
}): number {
  const { row, guidedStatus, hasQualifyingIntegration, useCasesChosen, scanTerminal } = args;
  if (isGuidedPhase1Finished(guidedStatus ?? undefined)) return 5;

  let max = 0;
  if (guidedStatus && guidedStatus !== "NOT_STARTED") {
    max = Math.max(max, 1);
  }
  if (businessContextComplete(row ?? ({} as OrgOnboardingStateRow))) {
    max = Math.max(max, 2);
  }
  if (hasQualifyingIntegration) {
    max = Math.max(max, 3);
  }
  if (useCasesChosen) {
    max = Math.max(max, 4);
  }
  if (scanTerminal === "completed" || scanTerminal === "failed" || guidedStatus === "RESULTS_READY") {
    max = Math.max(max, 5);
  }
  if (scanTerminal === "queued" || scanTerminal === "running") {
    max = Math.max(max, 4);
  }
  return max;
}

export function clampGuidedStepKey(
  key: string | null | undefined,
  maxIndex: number
): GuidedStepKey {
  const raw = (key && GUIDED_STEP_ORDER.includes(key as GuidedStepKey) ? key : "welcome") as GuidedStepKey;
  const idx = GUIDED_STEP_ORDER.indexOf(raw);
  const clampedIdx = Math.min(Math.max(idx, 0), maxIndex);
  return GUIDED_STEP_ORDER[clampedIdx] ?? "welcome";
}

export function resolveGuidedStepForRender(args: {
  row: OrgOnboardingStateRow | null;
  guidedStatus: string | null | undefined;
  maxIndex: number;
  queryStep: string | null | undefined;
}): GuidedStepKey {
  const { row, maxIndex, queryStep } = args;
  const dbKey = (row?.guided_current_step_key ?? "welcome") as GuidedStepKey;
  const raw = queryStep && GUIDED_STEP_ORDER.includes(queryStep as GuidedStepKey) ? (queryStep as GuidedStepKey) : dbKey;
  return clampGuidedStepKey(raw, maxIndex);
}

export function computeGuidedPercentComplete(args: {
  row: OrgOnboardingStateRow | null;
  hasQualifyingIntegration: boolean;
  useCasesChosen: boolean;
  scanTerminal: "none" | "queued" | "running" | "completed" | "failed";
  resultsViewed: boolean;
  guidedStatus: string | null | undefined;
}): number {
  const { row, hasQualifyingIntegration, useCasesChosen, scanTerminal, resultsViewed, guidedStatus } = args;
  const parts: boolean[] = [
    guidedStatus != null && guidedStatus !== "NOT_STARTED",
    businessContextComplete(row ?? ({} as OrgOnboardingStateRow)),
    hasQualifyingIntegration,
    useCasesChosen,
    scanTerminal === "completed" || scanTerminal === "failed",
    resultsViewed || guidedStatus === "COMPLETED" || guidedStatus === "RESULTS_READY",
  ];
  const done = parts.filter(Boolean).length;
  return Math.round((done / 6) * 100);
}

export async function syncGuidedProgressToCanonicalSteps(
  supabase: SupabaseClient,
  orgId: string,
  row: OrgOnboardingStateRow | null
): Promise<void> {
  if (!row) return;
  if (businessContextComplete(row)) {
    await markStepCompleted(supabase, orgId, "confirm_org_profile");
  }
  const { hasQualifyingIntegration } = await computeGuidedSetupFlags(supabase, orgId, row);
  if (hasQualifyingIntegration) {
    await markStepCompleted(supabase, orgId, "connect_primary_integration");
  }
}
