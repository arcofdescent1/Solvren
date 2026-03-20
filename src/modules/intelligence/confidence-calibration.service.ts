/**
 * Phase 6 — Confidence calibration (B2.2). v0: deterministic stub; wire to verification outcomes later.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type CalibrationSnapshot = {
  version: string;
  /** Additive modifier for displayed issue confidence (-20 … +20 points). */
  issueConfidenceModifier: number;
  /** Additive modifier for impact confidence. */
  impactConfidenceModifier: number;
  notes: string;
};

export async function getCalibrationForOrg(
  _supabase: SupabaseClient,
  _orgId: string
): Promise<CalibrationSnapshot> {
  void _supabase;
  void _orgId;
  return {
    version: "v0-stub",
    issueConfidenceModifier: 0,
    impactConfidenceModifier: 0,
    notes:
      "Calibration will use historical outcomes and verification data as volume grows.",
  };
}
