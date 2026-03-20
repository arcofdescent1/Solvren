/**
 * Gap 5 — Onboarding tracker. Evaluates org state and updates granular progress.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrgOnboardingState, upsertOrgOnboardingState } from "../repositories/org-onboarding-states.repository";
import { initializeOnboarding } from "./onboarding-engine.service";

export type OnboardingStage =
  | "not_started"
  | "connected"
  | "detecting"
  | "acting"
  | "verifying"
  | "complete";

export type OnboardingProgress = {
  integrationsConnected: boolean;
  firstSignalReceived: boolean;
  firstIssueDetected: boolean;
  firstActionExecuted: boolean;
  firstValueVerified: boolean;
  stage: OnboardingStage;
  percentComplete: number;
};

async function hasConnectedIntegrations(supabase: SupabaseClient, orgId: string): Promise<boolean> {
  const { data, count } = await supabase
    .from("integration_accounts")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("status", "connected");
  return (count ?? 0) > 0;
}

async function hasReceivedSignals(supabase: SupabaseClient, orgId: string): Promise<boolean> {
  const { count } = await supabase
    .from("integration_inbound_events")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .in("ingest_status", ["PROCESSED", "VALIDATED", "QUEUED"]);
  if ((count ?? 0) > 0) return true;
  const { count: signalCount } = await supabase
    .from("normalized_signals")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);
  return (signalCount ?? 0) > 0;
}

async function hasDetectedIssues(supabase: SupabaseClient, orgId: string): Promise<boolean> {
  const { count } = await supabase
    .from("issues")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);
  return (count ?? 0) > 0;
}

async function hasExecutedActions(supabase: SupabaseClient, orgId: string): Promise<boolean> {
  const { count: execCount } = await supabase
    .from("integration_action_executions")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .in("execution_status", ["SUCCESS", "VERIFIED", "PARTIAL_SUCCESS"]);
  if ((execCount ?? 0) > 0) return true;
  const { data: issueIds } = await supabase.from("issues").select("id").eq("org_id", orgId);
  const ids = (issueIds ?? []).map((r: { id: string }) => r.id);
  if (ids.length === 0) return false;
  const { count: issueActionsCount } = await supabase
    .from("issue_actions")
    .select("id", { count: "exact", head: true })
    .eq("action_status", "done")
    .in("issue_id", ids);
  return (issueActionsCount ?? 0) > 0;
}

async function hasVerifiedValue(supabase: SupabaseClient, orgId: string): Promise<boolean> {
  const { count } = await supabase
    .from("value_events")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);
  if ((count ?? 0) > 0) return true;
  const { count: outcomesCount } = await supabase
    .from("outcomes")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .in("outcome_type", ["recovered_revenue", "avoided_loss"]);
  return (outcomesCount ?? 0) > 0;
}

export async function evaluateAndUpdateOnboarding(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ progress: OnboardingProgress; error: Error | null }> {
  const { data: state, error } = await getOrgOnboardingState(supabase, orgId);
  if (error) return { progress: defaultProgress(), error };

  let row = state ?? null;
  if (!row) {
    await initializeOnboarding(supabase, orgId);
    const { data: after } = await getOrgOnboardingState(supabase, orgId);
    row = after ?? null;
  }

  const integrationsConnected = row?.integrations_connected ?? (await hasConnectedIntegrations(supabase, orgId));
  const firstSignalReceived = row?.first_signal_received ?? (await hasReceivedSignals(supabase, orgId));
  const firstIssueDetected = row?.first_issue_detected ?? (await hasDetectedIssues(supabase, orgId));
  const firstActionExecuted = row?.first_action_executed ?? (await hasExecutedActions(supabase, orgId));
  const firstValueVerified = row?.first_value_verified ?? (await hasVerifiedValue(supabase, orgId));

  const stage = deriveStage({
    integrationsConnected,
    firstSignalReceived,
    firstIssueDetected,
    firstActionExecuted,
    firstValueVerified,
  });

  const percentComplete = computePercentComplete({
    integrationsConnected,
    firstSignalReceived,
    firstIssueDetected,
    firstActionExecuted,
    firstValueVerified,
  });

  const stageToState: Record<OnboardingStage, string> = {
    not_started: "NOT_STARTED",
    connected: "IN_PROGRESS",
    detecting: "IN_PROGRESS",
    acting: "IN_PROGRESS",
    verifying: "IN_PROGRESS",
    complete: "FIRST_VALUE_REACHED",
  };

  const updateRow: Record<string, unknown> = {
    org_id: orgId,
    integrations_connected: integrationsConnected,
    first_signal_received: firstSignalReceived,
    first_issue_detected: firstIssueDetected,
    first_action_executed: firstActionExecuted,
    first_value_verified: firstValueVerified,
    onboarding_stage: stage,
    onboarding_state: stageToState[stage],
    updated_at: new Date().toISOString(),
  };
  if (firstValueVerified && !row?.first_value_reached) {
    updateRow.first_value_reached = true;
    updateRow.first_value_at = new Date().toISOString();
  }

  await supabase.from("org_onboarding_states").upsert(updateRow as Record<string, never>, { onConflict: "org_id" });

  return {
    progress: {
      integrationsConnected,
      firstSignalReceived,
      firstIssueDetected,
      firstActionExecuted,
      firstValueVerified,
      stage,
      percentComplete,
    },
    error: null,
  };
}

function deriveStage(flags: {
  integrationsConnected: boolean;
  firstSignalReceived: boolean;
  firstIssueDetected: boolean;
  firstActionExecuted: boolean;
  firstValueVerified: boolean;
}): OnboardingStage {
  if (flags.firstValueVerified) return "complete";
  if (flags.firstActionExecuted) return "verifying";
  if (flags.firstIssueDetected) return "acting";
  if (flags.firstSignalReceived) return "detecting";
  if (flags.integrationsConnected) return "connected";
  return "not_started";
}

function computePercentComplete(flags: {
  integrationsConnected: boolean;
  firstSignalReceived: boolean;
  firstIssueDetected: boolean;
  firstActionExecuted: boolean;
  firstValueVerified: boolean;
}): number {
  const steps = [
    flags.integrationsConnected,
    flags.firstSignalReceived,
    flags.firstIssueDetected,
    flags.firstActionExecuted,
    flags.firstValueVerified,
  ];
  const done = steps.filter(Boolean).length;
  return Math.round((done / 5) * 100);
}

function defaultProgress(): OnboardingProgress {
  return {
    integrationsConnected: false,
    firstSignalReceived: false,
    firstIssueDetected: false,
    firstActionExecuted: false,
    firstValueVerified: false,
    stage: "not_started",
    percentComplete: 0,
  };
}
