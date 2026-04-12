/**
 * Phase 10 — Onboarding engine (§11.2).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { OnboardingState } from "../domain";
import { FIRST_VALUE_MILESTONES } from "../domain";
import { getOrgOnboardingState, upsertOrgOnboardingState } from "../repositories/org-onboarding-states.repository";
import {
  initializeOrgOnboardingSteps,
  listOrgOnboardingSteps,
  updateOrgOnboardingStep,
} from "../repositories/org-onboarding-steps.repository";
import {
  listOrgOnboardingMilestones,
  markMilestoneReached,
} from "../repositories/org-onboarding-milestones.repository";

export async function initializeOnboarding(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ error: Error | null }> {
  const { data: existing } = await getOrgOnboardingState(supabase, orgId);
  if (existing) return { error: null };

  await upsertOrgOnboardingState(supabase, {
    orgId,
    onboardingState: OnboardingState.NOT_STARTED,
    guidedFlowVersion: "1",
    guidedPhase1Status: "NOT_STARTED",
    guidedCurrentStepKey: "welcome",
  });
  await markMilestoneReached(supabase, orgId, "org_created");
  const { error } = await initializeOrgOnboardingSteps(supabase, orgId);
  return { error };
}

export async function evaluateOnboardingState(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ state: OnboardingState; error: Error | null }> {
  const { data: obState, error: stateErr } = await getOrgOnboardingState(supabase, orgId);
  if (stateErr) return { state: OnboardingState.NOT_STARTED, error: stateErr };

  if (!obState) {
    await initializeOnboarding(supabase, orgId);
    return { state: OnboardingState.NOT_STARTED, error: null };
  }

  const { data: steps } = await listOrgOnboardingSteps(supabase, orgId);
  await listOrgOnboardingMilestones(supabase, orgId);

  let state = obState.onboarding_state as OnboardingState;

  if (obState.first_value_reached) {
    state = OnboardingState.FIRST_VALUE_REACHED;
  }
  if (obState.activated_at) {
    state = OnboardingState.ACTIVATED;
  }

  const completedCount = steps.filter((s) => s.stepStatus === "COMPLETED").length;
  const blockedRequired = steps.some((s) => s.required && s.stepStatus === "BLOCKED");
  const inProgressCount = steps.filter((s) => s.stepStatus === "IN_PROGRESS" || s.stepStatus === "PENDING").length;

  if (state === OnboardingState.NOT_STARTED && completedCount > 0) {
    state = OnboardingState.IN_PROGRESS;
  }
  if (blockedRequired && inProgressCount === 0 && !obState.first_value_reached) {
    state = OnboardingState.BLOCKED;
  }

  await upsertOrgOnboardingState(supabase, { orgId, onboardingState: state });
  return { state, error: null };
}

export async function markStepCompleted(
  supabase: SupabaseClient,
  orgId: string,
  stepKey: string,
  _payload?: Record<string, unknown>
): Promise<{ error: Error | null }> {
  const now = new Date().toISOString();
  const { error } = await updateOrgOnboardingStep(supabase, orgId, stepKey, {
    stepStatus: "COMPLETED",
    completedAt: now,
    blockedReasonCode: null,
    blockedReasonText: null,
  });
  if (error) return { error };
  await evaluateOnboardingState(supabase, orgId);
  return { error: null };
}

export async function markStepBlocked(
  supabase: SupabaseClient,
  orgId: string,
  stepKey: string,
  reason: { code?: string; text?: string }
): Promise<{ error: Error | null }> {
  const { error } = await updateOrgOnboardingStep(supabase, orgId, stepKey, {
    stepStatus: "BLOCKED",
    blockedReasonCode: reason.code ?? null,
    blockedReasonText: reason.text ?? null,
  });
  if (error) return { error };
  await evaluateOnboardingState(supabase, orgId);
  return { error: null };
}

export async function markMilestoneReachedService(
  supabase: SupabaseClient,
  orgId: string,
  milestoneKey: string,
  payload?: Record<string, unknown>
): Promise<{ error: Error | null }> {
  const { error } = await markMilestoneReached(supabase, orgId, milestoneKey as Parameters<typeof markMilestoneReached>[2], payload);
  if (error) return { error };

  if (FIRST_VALUE_MILESTONES.includes(milestoneKey as (typeof FIRST_VALUE_MILESTONES)[number])) {
    await upsertOrgOnboardingState(supabase, {
      orgId,
      firstValueReached: true,
      firstValueAt: new Date().toISOString(),
      onboardingState: OnboardingState.FIRST_VALUE_REACHED,
    });
  }

  await evaluateOnboardingState(supabase, orgId);
  return { error: null };
}
