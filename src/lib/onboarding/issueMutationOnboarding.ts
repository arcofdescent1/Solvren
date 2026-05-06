import type { SupabaseClient } from "@supabase/supabase-js";
import { hasReachedStep } from "./onboardingSteps";
import { getOnboardingState, recomputeOnboardingState } from "./onboardingStateService";

/**
 * Partial /issues API: block assign until FIRST_ACTION ordinal; resolve until FIRST_RESOLUTION.
 */
export async function assertIssueMutationAllowedByOnboarding(
  admin: SupabaseClient,
  orgId: string,
  kind: "assign" | "resolve" | "other"
): Promise<{ ok: true } | { ok: false; error: string }> {
  await recomputeOnboardingState(admin, orgId);
  const os = await getOnboardingState(admin, orgId);
  const step = os?.current_step ?? "CONNECT_INTEGRATION";

  if (kind === "assign") {
    if (!hasReachedStep(step, "FIRST_ACTION")) {
      return { ok: false, error: "Complete earlier onboarding steps before assigning issues." };
    }
    return { ok: true };
  }
  if (kind === "resolve") {
    if (!hasReachedStep(step, "FIRST_RESOLUTION")) {
      return { ok: false, error: "Complete earlier onboarding steps before resolving issues." };
    }
    return { ok: true };
  }
  return { ok: true };
}
