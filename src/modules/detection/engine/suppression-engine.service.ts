/**
 * Phase 4 — Suppression engine (§13).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSuppressionState } from "../persistence/suppression-state.repository";

export type SuppressionCheckInput = {
  orgId: string;
  detectorDefinitionId: string;
  dedupeKey: string;
  groupingKey: string;
  rolloutState: string;
};

export type SuppressionResult = {
  suppressed: boolean;
  reasons: string[];
};

export async function checkSuppression(
  supabase: SupabaseClient,
  input: SuppressionCheckInput
): Promise<SuppressionResult> {
  const reasons: string[] = [];

  if (input.rolloutState === "observe_only") {
    reasons.push("Rollout is observe-only; issues not created");
  }

  const state = await getSuppressionState(
    supabase,
    input.orgId,
    input.detectorDefinitionId,
    input.dedupeKey
  );
  if (state?.activeUntil && new Date(state.activeUntil) > new Date()) {
    reasons.push("Within cooldown/suppression window");
  }

  return {
    suppressed: reasons.length > 0,
    reasons,
  };
}
