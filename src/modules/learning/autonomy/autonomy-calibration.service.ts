/**
 * Phase 6 — Autonomy recommendations within governance caps (advisory only).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { listFeedbackFactsForOrg } from "../data/governance-feedback-facts.service";
import { insertRuleSuggestion } from "../repositories/governance-suggestions.repository";
import { proposeAutonomyBandFromFrictionScore } from "../calibration/autonomy-band-tuning.service";
import { getLearningControls, isFeatureEnabled } from "../learning-settings";

function frictionScoreFromLabels(labels: Array<{ label_type: string }>): number {
  let n = 0;
  let w = 0;
  for (const l of labels) {
    if (l.label_type.startsWith("BAD_") || l.label_type === "TOO_PERMISSIVE_AUTONOMY") {
      n++;
      w += 1;
    }
    if (l.label_type === "TOO_RESTRICTIVE_AUTONOMY" || l.label_type === "BAD_BLOCK") {
      n++;
      w += 0.5;
    }
  }
  if (n === 0) return 0;
  return Math.min(1, w / Math.max(3, n));
}

export async function suggestAutonomyCalibrationDraft(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ id: string | null; error: Error | null }> {
  const controls = await getLearningControls(supabase, orgId);
  if (!isFeatureEnabled(controls, "autonomy_suggestions")) {
    return { id: null, error: new Error("Autonomy suggestions disabled") };
  }

  const { data: feedback, error } = await listFeedbackFactsForOrg(supabase, orgId, { limit: 500 });
  if (error) return { id: null, error };

  const score = frictionScoreFromLabels(
    feedback.map((f) => ({ label_type: String(f.label_type ?? "") }))
  );
  const proposal = proposeAutonomyBandFromFrictionScore(score);
  if (!proposal) return { id: null, error: new Error("No autonomy proposal for current friction") };

  const { data, error: insErr } = await insertRuleSuggestion(supabase, {
    org_id: orgId,
    suggestion_type: "AUTONOMY_CAP_RECOMMENDATION",
    target_policy_id: null,
    suggested_rule_json: {
      recommendedMode: proposal.recommendedMode,
      parameterKey: proposal.parameterKey,
    },
    evidence_summary_json: { frictionScore: score, labelSample: feedback.length },
    simulation_summary_json: { advisory: true, mustStayWithinGovernanceCaps: true },
  });

  return { id: data?.id ?? null, error: insErr };
}
