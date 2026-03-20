/**
 * Phase 5 — Candidate action filter service (§10).
 * Policy filter + context filter → eligible, blocked, ineligible.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DecisionContext } from "../domain/decision-context";
import type { CandidateAction } from "../domain/candidate-action";
import type { BlockedAction } from "../domain/blocked-action";
import { getAction } from "@/modules/execution/registry/action-registry";
import { evaluate } from "@/modules/policy/services/policy-engine.service";

export type FilterResult = {
  eligible: Array<CandidateAction & { approvalRequired: boolean }>;
  blocked: BlockedAction[];
  ineligible: BlockedAction[];
};

function toCandidateAction(actionKey: string): CandidateAction | null {
  const def = getAction(actionKey);
  if (!def) return null;
  const [provider] = actionKey.split(".");
  return {
    actionKey: def.actionKey,
    provider: def.provider ?? provider ?? null,
    category: def.category,
    riskLevel: def.riskLevel,
    requiresEntityType: def.entityType ?? null,
  };
}

export async function filterCandidateActions(
  supabase: SupabaseClient,
  ctx: DecisionContext
): Promise<FilterResult> {
  const eligible: Array<CandidateAction & { approvalRequired: boolean }> = [];
  const blocked: BlockedAction[] = [];
  const ineligible: BlockedAction[] = [];

  for (const key of ctx.candidateActionKeys) {
    const candidate = toCandidateAction(key);
    if (!candidate) {
      ineligible.push({
        actionKey: key,
        reasonCode: "action_not_in_registry",
        reasonText: `Action "${key}" is not in the action registry.`,
      });
      continue;
    }

    const policyCtx = {
      orgId: ctx.orgId,
      environment: ctx.environment,
      issueId: ctx.issueId,
      findingId: ctx.findingId,
      issueFamily: ctx.issueFamily,
      detectorKey: ctx.detectorKey,
      playbookKey: ctx.playbookKey,
      workflowStepKey: ctx.workflowStepKey,
      actionKey: key,
      provider: candidate.provider ?? undefined,
      primaryEntityType: ctx.primaryEntityType ?? undefined,
      primaryEntityId: ctx.primaryEntityId ?? undefined,
      severity: ctx.severity,
      priorityBand: ctx.priorityBand,
      riskLevel: candidate.riskLevel,
      impactAmount: ctx.impactAmount,
      confidenceScore: ctx.confidenceScore,
      requestedMode: ctx.requestedMode,
      metadata: ctx.metadata,
    };

    const { data: policyDecision, error: policyError } = await evaluate(supabase, policyCtx);

    if (policyError) {
      blocked.push({
        actionKey: key,
        reasonCode: "policy_evaluation_error",
        reasonText: policyError.message,
      });
      continue;
    }

    if (policyDecision?.blocked) {
      blocked.push({
        actionKey: key,
        reasonCode: policyDecision.decisionReasonCode || "policy_blocked",
        reasonText: policyDecision.decisionMessage || "Action blocked by policy.",
      });
      continue;
    }

    if (candidate.requiresEntityType && !ctx.primaryEntityType) {
      ineligible.push({
        actionKey: key,
        reasonCode: "missing_required_entity",
        reasonText: `Action requires entity type "${candidate.requiresEntityType}" but none is set.`,
      });
      continue;
    }

    eligible.push({
      ...candidate,
      approvalRequired: policyDecision?.requiresApproval ?? false,
    });
  }

  return { eligible, blocked, ineligible };
}
