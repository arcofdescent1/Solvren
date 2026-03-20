/**
 * Gap 5 — First value engine (§7).
 * Evaluates when org reaches first value and triggers milestone.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluateAndUpdateOnboarding } from "./onboarding-tracker.service";
import { markMilestoneReachedService } from "./onboarding-engine.service";

export type FirstValueResult = {
  reached: boolean;
  stage: string;
  percentComplete: number;
};

export async function evaluateFirstValue(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ result: FirstValueResult; error: Error | null }> {
  const { progress, error } = await evaluateAndUpdateOnboarding(supabase, orgId);
  if (error) return { result: { reached: false, stage: "not_started", percentComplete: 0 }, error };

  if (progress.firstValueVerified) {
    await markMilestoneReachedService(supabase, orgId, "first_value", {
      stage: progress.stage,
      percentComplete: progress.percentComplete,
    });
  }

  return {
    result: {
      reached: progress.firstValueVerified,
      stage: progress.stage,
      percentComplete: progress.percentComplete,
    },
    error: null,
  };
}
