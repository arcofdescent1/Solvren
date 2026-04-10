/**
 * Phase 10 — Activation recommendations (§13).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAccountsByOrg } from "@/modules/integrations/core/integrationAccountsRepo";
import { getOrgPlaybookConfigs } from "@/modules/autonomy/persistence/playbooks.repository";
import { listPlaybookDefinitions } from "@/modules/autonomy/persistence/playbooks.repository";
import { listOrgOnboardingSteps } from "../repositories/org-onboarding-steps.repository";

export type RecommendationOutput = {
  recommendationType: string;
  targetKey: string;
  title: string;
  description: string;
  confidenceScore: number;
};

export async function getContextualRecommendations(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ recommendations: RecommendationOutput[]; error: Error | null }> {
  const recs: RecommendationOutput[] = [];
  const { data: accounts } = await getAccountsByOrg(supabase, orgId);
  const { data: playbookConfigs } = await getOrgPlaybookConfigs(supabase, orgId);
  const { data: playbookDefs } = await listPlaybookDefinitions(supabase, "active");
  const { data: steps } = await listOrgOnboardingSteps(supabase, orgId);

  const connectedProviders = new Set((accounts ?? []).filter((a) => a.status === "connected").map((a) => a.provider));
  const enabledPlaybookIds = new Set((playbookConfigs ?? []).filter((c) => c.enabled).map((c) => c.playbook_definition_id));
  const blockedSteps = (steps ?? []).filter((s) => s.stepStatus === "BLOCKED" && s.required);

  if (connectedProviders.size === 0) {
    recs.push({
      recommendationType: "connect_integration",
      targetKey: "stripe",
      title: "Connect Stripe",
      description: "Connect Stripe to activate Failed Payment Recovery and recover revenue.",
      confidenceScore: 95,
    });
  }

  if (connectedProviders.size > 0 && enabledPlaybookIds.size === 0) {
    const def = playbookDefs?.[0];
    if (def) {
      recs.push({
        recommendationType: "enable_playbook",
        targetKey: def.playbook_key,
        title: `Enable ${def.display_name}`,
        description: def.description,
        confidenceScore: 90,
      });
    }
  }

  if (blockedSteps.length > 0) {
    const s = blockedSteps[0];
    recs.push({
      recommendationType: "fix_blocked_step",
      targetKey: s.stepKey,
      title: `Fix: ${s.displayName}`,
      description: s.blockedReasonText ?? s.description,
      confidenceScore: 100,
    });
  }

  return { recommendations: recs, error: null };
}
