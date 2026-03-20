/**
 * Phase 10 — org_onboarding_steps repository.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OnboardingStep, OnboardingStepStatus } from "../domain";
import { DEFAULT_ONBOARDING_STEPS } from "../domain";

export type OrgOnboardingStepRow = {
  id: string;
  org_id: string;
  step_key: string;
  step_group: string;
  display_name: string;
  description: string;
  step_status: string;
  required: boolean;
  blocked_reason_code: string | null;
  blocked_reason_text: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

function rowToStep(r: OrgOnboardingStepRow): OnboardingStep {
  return {
    id: r.id,
    orgId: r.org_id,
    stepKey: r.step_key,
    stepGroup: r.step_group as OnboardingStep["stepGroup"],
    displayName: r.display_name,
    description: r.description,
    stepStatus: r.step_status as OnboardingStepStatus,
    required: r.required,
    blockedReasonCode: r.blocked_reason_code ?? undefined,
    blockedReasonText: r.blocked_reason_text ?? undefined,
    completedAt: r.completed_at ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listOrgOnboardingSteps(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ data: OnboardingStep[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("org_onboarding_steps")
    .select("*")
    .eq("org_id", orgId)
    .order("step_group")
    .order("step_key");
  if (error) return { data: [], error: error as Error };
  return { data: (data ?? []).map((r) => rowToStep(r as OrgOnboardingStepRow)), error: null };
}

export async function initializeOrgOnboardingSteps(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ error: Error | null }> {
  const { data: existing } = await supabase
    .from("org_onboarding_steps")
    .select("step_key")
    .eq("org_id", orgId);
  const existingKeys = new Set((existing ?? []).map((r: { step_key: string }) => r.step_key));

  const toInsert = DEFAULT_ONBOARDING_STEPS.filter((s) => !existingKeys.has(s.stepKey)).map((s) => ({
    org_id: orgId,
    step_key: s.stepKey,
    step_group: s.stepGroup,
    display_name: s.displayName,
    description: s.description,
    step_status: "PENDING",
    required: s.required,
  }));

  if (toInsert.length === 0) return { error: null };
  const { error } = await supabase.from("org_onboarding_steps").insert(toInsert);
  return { error: error as Error | null };
}

export async function updateOrgOnboardingStep(
  supabase: SupabaseClient,
  orgId: string,
  stepKey: string,
  updates: {
    stepStatus?: OnboardingStepStatus;
    blockedReasonCode?: string | null;
    blockedReasonText?: string | null;
    completedAt?: string | null;
  }
): Promise<{ error: Error | null }> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.stepStatus != null) row.step_status = updates.stepStatus;
  if (updates.blockedReasonCode !== undefined) row.blocked_reason_code = updates.blockedReasonCode;
  if (updates.blockedReasonText !== undefined) row.blocked_reason_text = updates.blockedReasonText;
  if (updates.completedAt !== undefined) row.completed_at = updates.completedAt;

  const { error } = await supabase
    .from("org_onboarding_steps")
    .update(row)
    .eq("org_id", orgId)
    .eq("step_key", stepKey);
  return { error: error as Error | null };
}
