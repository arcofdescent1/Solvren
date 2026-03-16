import { validateChangeIntake } from "./validateChangeIntake";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SubmissionReadinessResult = {
  ready: boolean;
  issues: string[];
};

/**
 * Evaluates whether a change is ready for submission (DRAFT/READY → IN_REVIEW).
 * Aligns with validateChangeIntake + assessment existence.
 * Evidence and approvals are NOT required for submission—they're created at submit time.
 */
export async function evaluateReadinessForSubmission(
  supabase: SupabaseClient,
  change: Record<string, unknown> | null | undefined
): Promise<SubmissionReadinessResult> {
  const intakeResult = validateChangeIntake(change);
  if (!intakeResult.ok) {
    return { ready: false, issues: intakeResult.errors };
  }

  const changeId = change?.id as string | undefined;
  if (!changeId) {
    return { ready: false, issues: ["Change not found"] };
  }

  const { data: assessment } = await supabase
    .from("impact_assessments")
    .select("id, risk_bucket")
    .eq("change_event_id", changeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!assessment?.id) {
    return { ready: false, issues: ["Risk assessment not yet computed"] };
  }

  return { ready: true, issues: [] };
}
