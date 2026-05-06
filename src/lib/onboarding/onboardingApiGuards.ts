import type { SupabaseClient } from "@supabase/supabase-js";
import { hasReachedStep } from "./onboardingSteps";
import { getOnboardingState, recomputeOnboardingState } from "./onboardingStateService";

export async function requireOnboardingComplete(admin: SupabaseClient, orgId: string): Promise<void> {
  await recomputeOnboardingState(admin, orgId);
  const row = await getOnboardingState(admin, orgId);
  const step = row?.current_step ?? "CONNECT_INTEGRATION";
  if (!hasReachedStep(step, "COMPLETE")) {
    throw new Error("onboarding_incomplete");
  }
}

export async function requireReachedStep(
  admin: SupabaseClient,
  orgId: string,
  requiredStep: string
): Promise<void> {
  await recomputeOnboardingState(admin, orgId);
  const row = await getOnboardingState(admin, orgId);
  const step = row?.current_step ?? "CONNECT_INTEGRATION";
  if (!hasReachedStep(step, requiredStep)) {
    throw new Error("onboarding_step_required");
  }
}
