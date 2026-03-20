/**
 * Phase 7 — Verification engine: record outcome after execution success (§14).
 * DETECT → QUANTIFY → EXECUTE → VERIFY → LEARN
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { insertOutcome } from "../persistence/outcomes.repository";
import { recomputeIssueOutcomeSummary } from "../persistence/issue-outcome-summary.repository";

export type RecordOutcomeInput = {
  orgId: string;
  issueId: string;
  actionId: string;
  actionType: string;
  amount: number;
  outcomeType: "recovered_revenue" | "avoided_loss" | "operational_savings";
  confidenceScore?: number;
  evidence?: Record<string, unknown>;
};

/** Infer outcome type from action type when not explicitly provided. */
export function inferOutcomeTypeFromAction(actionType: string): "recovered_revenue" | "avoided_loss" | "operational_savings" {
  if (actionType.includes("retry_payment") || actionType.includes("update_payment")) return "recovered_revenue";
  if (actionType.includes("assign_owner") || actionType.includes("create_task") || actionType.includes("update_stage")) return "avoided_loss";
  return "operational_savings";
}

/** Record outcome after successful action execution and recompute issue summary. */
export async function recordOutcomeFromAction(
  supabase: SupabaseClient,
  input: RecordOutcomeInput
): Promise<{ outcomeId: string | null; error?: string }> {
  const { data: outcome, error } = await insertOutcome(supabase, {
    org_id: input.orgId,
    issue_id: input.issueId,
    action_id: input.actionId,
    outcome_type: input.outcomeType,
    amount: input.amount,
    currency: "USD",
    verification_type: "inferred",
    confidence_score: input.confidenceScore ?? 0.8,
    evidence_json: {
      action_type: input.actionType,
      ...input.evidence,
    },
  });

  if (error || !outcome) {
    return { outcomeId: null, error: (error as Error)?.message ?? "Failed to insert outcome" };
  }

  const { error: summaryErr } = await recomputeIssueOutcomeSummary(supabase, input.issueId, input.orgId);
  if (summaryErr) {
    return { outcomeId: outcome.id, error: (summaryErr as Error).message };
  }

  const { emitRevenueRecovered, emitLossAvoided, emitOperationalSavings } = await import(
    "@/modules/timeline/services/timeline-event-emitter"
  );
  const amt = input.amount;
  const headline =
    input.outcomeType === "recovered_revenue"
      ? "Revenue recovered"
      : input.outcomeType === "avoided_loss"
        ? "Loss avoided"
        : "Operational savings recorded";
  const summary = `${headline}: $${amt.toLocaleString()} (action ${input.actionType})`;
  if (input.outcomeType === "recovered_revenue") {
    await emitRevenueRecovered(supabase, { orgId: input.orgId, issueId: input.issueId, amount: amt, headline, summary });
  } else if (input.outcomeType === "avoided_loss") {
    await emitLossAvoided(supabase, { orgId: input.orgId, issueId: input.issueId, amount: amt, headline, summary });
  } else {
    await emitOperationalSavings(supabase, { orgId: input.orgId, issueId: input.issueId, amount: amt, headline, summary });
  }

  // Phase 10 + Gap 5 — First value instrumentation + value_events
  if (input.outcomeType === "recovered_revenue" || input.outcomeType === "avoided_loss") {
    const { recordValueEvent } = await import("@/modules/onboarding/services/value-tracking.service");
    await recordValueEvent(supabase, {
      orgId: input.orgId,
      issueId: input.issueId,
      valueType: input.outcomeType === "recovered_revenue" ? "recovered" : "avoided",
      amount: input.amount,
      confidence: input.confidenceScore,
    });

    const { getMilestoneReached } = await import("@/modules/onboarding/repositories/org-onboarding-milestones.repository");
    const { markMilestoneReachedService } = await import("@/modules/onboarding/services/onboarding-engine.service");
    const milestoneKey = input.outcomeType === "recovered_revenue" ? "first_recovered_revenue" : "first_avoided_loss";
    const { reached } = await getMilestoneReached(supabase, input.orgId, milestoneKey);
    if (!reached) {
      await markMilestoneReachedService(supabase, input.orgId, milestoneKey, { amount: amt });
    }
  }

  return { outcomeId: outcome.id };
}
