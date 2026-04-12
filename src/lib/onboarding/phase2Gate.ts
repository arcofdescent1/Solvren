/**
 * Phase 2 — activation wizard entry guard (after guided Phase 1 is finished).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrgOnboardingState } from "@/modules/onboarding/repositories/org-onboarding-states.repository";
import { isGuidedPhase1Finished } from "@/modules/onboarding/services/guided-phase1-state.service";
import { meetsPhase2TechnicalPrerequisites, isPhase2Terminal } from "@/modules/onboarding/phase2/phase2-entry.service";

/**
 * Paths that may be visited while Phase 2 is incomplete without forcing `/onboarding/activation`.
 * Keep this tight: integration/settings flows and shell landing exits only.
 * Deep links (e.g. `/issues/...`) open in a new tab from the activation wizard so this list stays small.
 */
const ALLOWED_PREFIXES = [
  "/onboarding/activation",
  "/onboarding/adoption",
  "/onboarding/enterprise",
  "/integrations",
  "/marketplace/integrations",
  "/org/settings",
  "/dashboard",
  "/home",
];

export function isPhase2ActivationBypassPath(pathname: string): boolean {
  const p = pathname.split("?")[0] ?? "";
  if (!p) return false;
  return ALLOWED_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}

export async function shouldRedirectToPhase2Activation(
  supabase: SupabaseClient,
  orgId: string,
  pathname: string
): Promise<boolean> {
  if (isPhase2ActivationBypassPath(pathname)) return false;
  const { data: row } = await getOrgOnboardingState(supabase, orgId);
  if (!row) return false;
  if (!isGuidedPhase1Finished(row.guided_phase1_status)) return false;
  if (isPhase2Terminal(row.phase2_status)) return false;
  if (!(await meetsPhase2TechnicalPrerequisites(supabase, orgId, row))) return false;

  const s = row.phase2_status;
  return s == null || s === "NOT_STARTED" || s === "IN_PROGRESS" || s === "WAITING_FOR_EVENT";
}
