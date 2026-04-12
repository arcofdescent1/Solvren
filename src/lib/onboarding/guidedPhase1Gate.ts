/**
 * Guided Phase 1 — app-shell entry guard (org-scoped; no middleware).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrgOnboardingState } from "@/modules/onboarding/repositories/org-onboarding-states.repository";
import { isGuidedPhase1Finished } from "@/modules/onboarding/services/guided-phase1-state.service";

const ALLOWED_PATH_PREFIXES = [
  "/onboarding",
  "/onboarding/activation",
  "/integrations",
  "/marketplace/integrations",
  "/org/settings",
];

export function isGuidedOnboardingPathAllowed(pathname: string): boolean {
  const p = pathname.split("?")[0] ?? "";
  if (!p) return false;
  return ALLOWED_PATH_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}

export async function shouldRedirectToGuidedOnboarding(
  supabase: SupabaseClient,
  orgId: string,
  pathname: string
): Promise<boolean> {
  if (isGuidedOnboardingPathAllowed(pathname)) return false;
  const { data: row } = await getOrgOnboardingState(supabase, orgId);
  if (!row) return false;
  return !isGuidedPhase1Finished(row.guided_phase1_status);
}
