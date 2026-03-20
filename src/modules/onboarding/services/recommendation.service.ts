/**
 * Gap 5 — Recommendation engine (§8).
 * Suggests integrations, detectors, playbooks based on onboarding state.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluateAndUpdateOnboarding } from "./onboarding-tracker.service";
import { getAccountsByOrg } from "@/modules/integrations/core/integrationAccountsRepo";
import { getOrgPlaybookConfigs } from "@/modules/autonomy/persistence/playbooks.repository";
import { listPlaybookDefinitions } from "@/modules/autonomy/persistence/playbooks.repository";

export type RecommendationType = "integration" | "detector" | "playbook";

export type Recommendation = {
  type: RecommendationType;
  title: string;
  reason: string;
  priority: number;
  targetKey?: string;
  href?: string;
};

export async function getRecommendations(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ recommendations: Recommendation[]; error: Error | null }> {
  const { progress } = await evaluateAndUpdateOnboarding(supabase, orgId);
  const recs: Recommendation[] = [];

  const { data: accounts } = await getAccountsByOrg(supabase, orgId);
  const { data: playbookConfigs } = await getOrgPlaybookConfigs(supabase, orgId);
  const { data: playbookDefs } = await listPlaybookDefinitions(supabase, "active");

  const defs = playbookDefs ?? [];
  const defById = new Map(defs.map((d) => [d.id, d]));
  const connectedProviders = new Set((accounts ?? []).filter((a) => a.status === "connected").map((a) => a.provider));
  const enabledPlaybookKeys = new Set(
    (playbookConfigs ?? [])
      .filter((c) => c.enabled)
      .map((c) => defById.get(c.playbook_definition_id)?.playbook_key)
      .filter((k): k is string => Boolean(k))
  );

  if (!progress.integrationsConnected || connectedProviders.size === 0) {
    recs.push({
      type: "integration",
      title: "Connect Stripe",
      reason: "Connect Stripe to detect failed payments and recover revenue",
      priority: 100,
      targetKey: "stripe",
      href: "/settings/integrations",
    });
  }

  if (progress.integrationsConnected && !progress.firstIssueDetected) {
    recs.push({
      type: "detector",
      title: "Enable detector packs",
      reason: "Enable detector packs to surface revenue-impacting issues",
      priority: 90,
      href: "/settings/detectors",
    });
  }

  if (progress.firstIssueDetected && !progress.firstActionExecuted && enabledPlaybookKeys.size === 0) {
    const def = (playbookDefs ?? [])[0];
    if (def) {
      recs.push({
        type: "playbook",
        title: `Enable ${def.display_name}`,
        reason: def.description,
        priority: 95,
        targetKey: def.playbook_key,
        href: "/settings/playbooks",
      });
    }
  }

  if (progress.firstActionExecuted && !progress.firstValueVerified) {
    recs.push({
      type: "playbook",
      title: "Verify your first value",
      reason: "Check the ROI dashboard to see recovered revenue and avoided loss",
      priority: 85,
      href: "/dashboard",
    });
  }

  return { recommendations: recs.sort((a, b) => b.priority - a.priority), error: null };
}
