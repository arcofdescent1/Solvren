/**
 * Phase 2 — entry prerequisites (Phase 1 complete + qualifying integration + successful baseline scan).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getScanRunById } from "../repositories/org-onboarding-scan-runs.repository";
import type { OrgOnboardingStateRow } from "../repositories/org-onboarding-states.repository";
import { hasQualifyingCrmOrPaymentConnection, listOnboardingIntegrationCards } from "../services/guided-phase1-integrations";

export function meetsPhase1CompletionForPhase2(guidedPhase1Status: string | null | undefined): boolean {
  return guidedPhase1Status === "COMPLETED";
}

export async function meetsPhase2TechnicalPrerequisites(
  supabase: SupabaseClient,
  orgId: string,
  row: OrgOnboardingStateRow | null
): Promise<boolean> {
  if (!row) return false;
  if (!meetsPhase1CompletionForPhase2(row.guided_phase1_status)) return false;
  if (row.guided_phase1_status === "SKIPPED") return false;

  const { cards } = await listOnboardingIntegrationCards(supabase, orgId);
  if (!hasQualifyingCrmOrPaymentConnection(cards)) return false;

  const scanId = row.latest_baseline_scan_id;
  if (!scanId) return false;
  const { data: scan } = await getScanRunById(supabase, scanId, orgId);
  return scan?.status === "COMPLETED";
}

export function isPhase2Terminal(status: string | null | undefined): boolean {
  return status === "COMPLETED" || status === "SKIPPED";
}
