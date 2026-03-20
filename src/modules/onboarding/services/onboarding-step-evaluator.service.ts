/**
 * Phase 10 — Onboarding step evaluator (§11.3).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAccountsByOrg } from "@/modules/integrations/core/integrationAccountsRepo";
import { getOrgPlaybookConfigs } from "@/modules/autonomy/persistence/playbooks.repository";
import { listOrgOnboardingSteps, updateOrgOnboardingStep } from "../repositories/org-onboarding-steps.repository";
import { markMilestoneReached } from "../repositories/org-onboarding-milestones.repository";

export async function evaluateSteps(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ error: Error | null }> {
  const { data: accounts } = await getAccountsByOrg(supabase, orgId);
  const { data: playbookConfigs } = await getOrgPlaybookConfigs(supabase, orgId);
  const { data: steps } = await listOrgOnboardingSteps(supabase, orgId);

  const connectedCount = accounts?.filter((a) => a.status === "connected").length ?? 0;
  const enabledPlaybooks = playbookConfigs?.filter((c) => c.enabled).length ?? 0;

  for (const step of steps) {
    if (step.stepStatus === "COMPLETED") continue;

    if (step.stepKey === "connect_primary_integration" && connectedCount >= 1) {
      await updateOrgOnboardingStep(supabase, orgId, step.stepKey, { stepStatus: "COMPLETED", completedAt: new Date().toISOString() });
      await markMilestoneReached(supabase, orgId, "first_integration_connected");
    }
    if (step.stepKey === "enable_first_playbook" && enabledPlaybooks >= 1) {
      await updateOrgOnboardingStep(supabase, orgId, step.stepKey, { stepStatus: "COMPLETED", completedAt: new Date().toISOString() });
      await markMilestoneReached(supabase, orgId, "first_playbook_enabled");
    }
  }

  return { error: null };
}
