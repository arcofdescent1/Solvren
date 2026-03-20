/**
 * Phase 10 — org_onboarding_states repository.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { OnboardingState } from "../domain";

export type OrgOnboardingStateRow = {
  org_id: string;
  onboarding_state: string;
  first_value_reached: boolean;
  first_value_at: string | null;
  activated_at: string | null;
  current_step_key: string | null;
  integrations_connected?: boolean;
  first_signal_received?: boolean;
  first_issue_detected?: boolean;
  first_action_executed?: boolean;
  first_value_verified?: boolean;
  onboarding_stage?: string | null;
  created_at: string;
  updated_at: string;
};

export async function getOrgOnboardingState(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ data: OrgOnboardingStateRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("org_onboarding_states")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();
  return { data: data as OrgOnboardingStateRow | null, error: error as Error | null };
}

export async function upsertOrgOnboardingState(
  supabase: SupabaseClient,
  input: {
    orgId: string;
    onboardingState?: OnboardingState;
    firstValueReached?: boolean;
    firstValueAt?: string | null;
    activatedAt?: string | null;
    currentStepKey?: string | null;
  }
): Promise<{ error: Error | null }> {
  const row: Record<string, unknown> = {
    org_id: input.orgId,
    updated_at: new Date().toISOString(),
  };
  if (input.onboardingState != null) row.onboarding_state = input.onboardingState;
  if (input.firstValueReached != null) row.first_value_reached = input.firstValueReached;
  if (input.firstValueAt !== undefined) row.first_value_at = input.firstValueAt;
  if (input.activatedAt !== undefined) row.activated_at = input.activatedAt;
  if (input.currentStepKey !== undefined) row.current_step_key = input.currentStepKey;

  const { error } = await supabase.from("org_onboarding_states").upsert(row, { onConflict: "org_id" });
  return { error: error as Error | null };
}
