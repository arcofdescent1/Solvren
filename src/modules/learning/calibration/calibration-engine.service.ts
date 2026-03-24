/**
 * Phase 6 — Bounded calibration orchestration (recommendations only).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { listDecisionFactsForOrg } from "../data/governance-decision-facts.service";
import { insertCalibrationRecommendation } from "../repositories/calibration-recommendations.repository";
import { proposeImpactThresholdFromFacts } from "./threshold-tuning.service";
import { getLearningControls, isFeatureEnabled } from "../learning-settings";

const DEFAULT_BOUNDS = { min: 0, max: 10_000_000 };

export type RunCalibrationOptions = {
  orgId: string;
  sinceDays?: number;
  bounds?: { min: number; max: number };
  calibrationJobVersion?: string;
};

export async function runImpactThresholdCalibration(
  supabase: SupabaseClient,
  options: RunCalibrationOptions
): Promise<{ createdId: string | null; error: Error | null }> {
  const controls = await getLearningControls(supabase, options.orgId);
  if (!isFeatureEnabled(controls, "calibration")) {
    return { createdId: null, error: new Error("Calibration disabled by kill switch") };
  }

  const since = new Date(Date.now() - (options.sinceDays ?? 30) * 86400000).toISOString();
  const { data: facts, error: fErr } = await listDecisionFactsForOrg(supabase, options.orgId, {
    limit: 2000,
    since,
  });
  if (fErr) return { createdId: null, error: fErr };

  const proposal = proposeImpactThresholdFromFacts(facts, options.bounds ?? DEFAULT_BOUNDS);
  if (!proposal) {
    return { createdId: null, error: new Error("Insufficient data for calibration") };
  }

  const { id, error } = await insertCalibrationRecommendation(supabase, {
    org_id: options.orgId,
    parameter_key: proposal.parameterKey,
    current_value_json: proposal.currentValue,
    proposed_value_json: proposal.proposedValue,
    min_bound_json: proposal.minBound,
    max_bound_json: proposal.maxBound,
    evidence_summary_json: {
      method: proposal.method,
      sampleSize: proposal.sampleSize,
    },
    simulation_summary_json: {
      note: "Calibration uses historical decision facts only; apply simulation before acceptance",
      productionGradeSimulationRequired: true,
    },
    trace_window_start: since,
    trace_window_end: new Date().toISOString(),
    calibration_job_version: options.calibrationJobVersion ?? "v1-heuristic",
  });

  return { createdId: id, error };
}
