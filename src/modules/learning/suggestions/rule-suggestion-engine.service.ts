/**
 * Phase 6 — Draft rule suggestions (never auto-activate).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { listDecisionFactsForOrg } from "../data/governance-decision-facts.service";
import { insertRuleSuggestion } from "../repositories/governance-suggestions.repository";
import { buildEvidenceSummaryFromFacts } from "./evidence-summary-builder";
import { assertSuggestionAllowedForPolicy } from "./guardrails";
import { getLearningControls, isFeatureEnabled } from "../learning-settings";

export async function generateFrictionRuleSuggestion(
  supabase: SupabaseClient,
  orgId: string,
  targetPolicyId: string | null,
  options?: { sinceDays?: number; generationVersion?: string }
): Promise<{ id: string | null; error: Error | null }> {
  const controls = await getLearningControls(supabase, orgId);
  if (!isFeatureEnabled(controls, "rule_suggestions")) {
    return { id: null, error: new Error("Rule suggestions disabled") };
  }

  const guard = await assertSuggestionAllowedForPolicy(supabase, targetPolicyId);
  if (!guard.ok) {
    return { id: null, error: new Error(guard.reason) };
  }

  const since = new Date(Date.now() - (options?.sinceDays ?? 30) * 86400000).toISOString();
  const { data: facts, error: fErr } = await listDecisionFactsForOrg(supabase, orgId, { limit: 2000, since });
  if (fErr) return { id: null, error: fErr };

  const blockRate =
    facts.length > 0 ? facts.filter((f) => f.disposition === "BLOCK").length / facts.length : 0;

  if (blockRate < 0.15) {
    return { id: null, error: new Error("Below friction threshold for suggestion") };
  }

  const evidence = buildEvidenceSummaryFromFacts(
    facts.map((f) => ({ disposition: f.disposition, action_key: f.action_key })),
    `last ${options?.sinceDays ?? 30} days`
  );

  const { data, error } = await insertRuleSuggestion(supabase, {
    org_id: orgId,
    suggestion_type: "REVIEW_HIGH_BLOCK_RATE",
    target_policy_id: targetPolicyId,
    suggested_rule_json: {
      note: "Draft: review rules driving blocks; do not apply without human approval",
      observedBlockRate: blockRate,
    },
    evidence_summary_json: evidence as unknown as Record<string, unknown>,
    simulation_summary_json: {
      productionGradeSimulationRequired: true,
      message: "Run governance simulation with real evaluateGovernance before acceptance",
    },
    generation_version: options?.generationVersion ?? "v1-friction-heuristic",
  });

  return { id: data?.id ?? null, error };
}
