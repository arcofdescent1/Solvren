/**
 * Central validation engine for change readiness.
 * Used by: submission readiness, submit endpoint, readiness UI, AI risk scoring, future API.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { runValidationRules } from "./validationRules";
import { buildResult, type ValidationResult } from "./validationTypes";
import { computeEvidenceScore } from "@/lib/governance/EvidenceScoringService";

export type ValidateChangeOptions = {
  changeId: string;
  supabase: SupabaseClient;
  /** When true, also require assessment to exist (for submission readiness). Default true. */
  requireAssessment?: boolean;
  /** When true, enforce evidence completeness (Phase A2). Default true. */
  requireEvidenceThreshold?: boolean;
};

/**
 * Main entry point: fetches change (and assessment if needed), runs rules, returns structured result.
 * Optimized: one change query + one assessment query when required.
 */
export async function validateChange(
  options: ValidateChangeOptions
): Promise<ValidationResult> {
  const { changeId, supabase, requireAssessment = true, requireEvidenceThreshold = true } = options;

  const { data: change, error: ceErr } = await supabase
    .from("change_events")
    .select("*")
    .eq("id", changeId)
    .maybeSingle();

  if (ceErr) {
    return buildResult([
      {
        code: "CHANGE_FETCH_ERROR",
        message: ceErr.message ?? "Failed to load change",
        severity: "ERROR",
      },
    ]);
  }

  const issues = runValidationRules(change as Record<string, unknown> | null);

  if (requireAssessment && change) {
    const { data: assessment } = await supabase
      .from("impact_assessments")
      .select("id")
      .eq("change_event_id", changeId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!assessment?.id) {
      issues.push({
        code: "ASSESSMENT_REQUIRED",
        message: "Risk assessment not yet computed",
        severity: "ERROR",
        category: "GOVERNANCE",
      });
    }
  }

  if (requireEvidenceThreshold && change) {
    const score = await computeEvidenceScore(supabase, changeId);
    if (score.blocked) {
      issues.push({
        code: "EVIDENCE_INCOMPLETE",
        message: `Evidence score ${Math.round(score.score * 100)}% below threshold (${Math.round(score.threshold * 100)}%). Required: ${score.completed}/${score.required} items (test plan, rollback plan, customer comms).`,
        severity: "ERROR",
        category: "EVIDENCE",
      });
    }
  }

  return buildResult(issues);
}
