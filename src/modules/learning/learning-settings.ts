/**
 * Phase 6 — Kill switches: env (global) + org_learning_settings.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type LearningFeature = "calibration" | "rule_suggestions" | "autonomy_suggestions";

export type LearningControls = {
  globalDisabled: boolean;
  orgLearningDisabled: boolean;
  calibrationDisabled: boolean;
  ruleSuggestionsDisabled: boolean;
  autonomySuggestionsDisabled: boolean;
};

function envGlobalDisabled(): boolean {
  const v = process.env.LEARNING_GLOBAL_DISABLED ?? process.env.NEXT_PUBLIC_LEARNING_GLOBAL_DISABLED;
  return v === "1" || v === "true";
}

export async function getLearningControls(
  supabase: SupabaseClient,
  orgId: string
): Promise<LearningControls> {
  const globalDisabled = envGlobalDisabled();
  const { data } = await supabase.from("org_learning_settings").select("*").eq("org_id", orgId).maybeSingle();

  const row = data as {
    learning_disabled?: boolean;
    calibration_disabled?: boolean;
    rule_suggestions_disabled?: boolean;
    autonomy_suggestions_disabled?: boolean;
  } | null;

  return {
    globalDisabled: globalDisabled,
    orgLearningDisabled: row?.learning_disabled ?? false,
    calibrationDisabled: globalDisabled || (row?.learning_disabled ?? false) || (row?.calibration_disabled ?? false),
    ruleSuggestionsDisabled:
      globalDisabled || (row?.learning_disabled ?? false) || (row?.rule_suggestions_disabled ?? false),
    autonomySuggestionsDisabled:
      globalDisabled || (row?.learning_disabled ?? false) || (row?.autonomy_suggestions_disabled ?? false),
  };
}

export function isFeatureEnabled(controls: LearningControls, feature: LearningFeature): boolean {
  if (controls.globalDisabled || controls.orgLearningDisabled) return false;
  switch (feature) {
    case "calibration":
      return !controls.calibrationDisabled;
    case "rule_suggestions":
      return !controls.ruleSuggestionsDisabled;
    case "autonomy_suggestions":
      return !controls.autonomySuggestionsDisabled;
    default:
      return false;
  }
}
