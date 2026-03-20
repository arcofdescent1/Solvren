/**
 * Phase 1 — Gather lifecycle invariant checks from DB.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getTerminalClassification } from "../repositories/issue-terminal-classification.repository";
import { getNoActionDecision } from "../repositories/issue-no-action-decision.repository";

export type LifecycleChecks = {
  hasImpactAttempt: boolean;
  hasActionAttempt: boolean;
  hasVerificationAttempt: boolean;
  hasTerminalClassification: boolean;
  hasNoActionDecision: boolean;
};

export async function gatherLifecycleChecks(
  supabase: SupabaseClient,
  issueId: string
): Promise<LifecycleChecks> {
  const [
    { data: impactRows },
    { data: actionRows },
    { data: verificationRows },
    { data: classification },
    { data: noAction },
  ] = await Promise.all([
    supabase
      .from("issue_impact_assessments")
      .select("id")
      .eq("issue_id", issueId)
      .limit(1),
    supabase.from("issue_actions").select("id").eq("issue_id", issueId).limit(1),
    supabase.from("verification_runs").select("id").eq("issue_id", issueId).limit(1),
    getTerminalClassification(supabase, issueId),
    getNoActionDecision(supabase, issueId),
  ]);

  return {
    hasImpactAttempt: (impactRows?.length ?? 0) > 0,
    hasActionAttempt: (actionRows?.length ?? 0) > 0,
    hasVerificationAttempt: (verificationRows?.length ?? 0) > 0,
    hasTerminalClassification: classification != null,
    hasNoActionDecision: noAction != null,
  };
}
