/**
 * Phase 9 — Execution mode resolver (§13).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ExecutionMode,
  AutonomyConfidenceBand,
  type AppEnvironment,
} from "../domain";
import { getEffectiveRequestedMode } from "../repositories/autonomy-mode-configs.repository";
import { resolvePauseEffect } from "./automation-pause.service";
import { computeAutonomyConfidence } from "./autonomy-confidence.service";
import { applyDowngrades } from "./downgrade-engine.service";
import { insertAutonomyDecisionState } from "../repositories/autonomy-decision-states.repository";

export type ResolveContext = {
  orgId: string;
  environment: AppEnvironment;
  issueId?: string | null;
  workflowRunId?: string | null;
  actionKey?: string | null;
  playbookKey?: string | null;
  provider?: string | null;
  scopeType?: string;
  scopeRef?: string | null;
  policyBlocked?: boolean;
  policyRequiresApproval?: boolean;
  confidenceInputs?: Parameters<typeof computeAutonomyConfidence>[0];
};

export type EffectiveExecutionModeResult = {
  requestedMode: ExecutionMode;
  effectiveMode: ExecutionMode;
  autonomyConfidenceScore: number;
  autonomyConfidenceBand: AutonomyConfidenceBand;
  downgradeReasonCodes: string[];
  pauseReasonCodes: string[];
};

const ORG_DEFAULT_MODE = ExecutionMode.APPROVAL_REQUIRED;

export async function resolveExecutionMode(
  supabase: SupabaseClient,
  context: ResolveContext
): Promise<{ data: EffectiveExecutionModeResult | null; error: Error | null }> {
  const downgradeReasonCodes: string[] = [];
  const pauseReasonCodes: string[] = [];

  let requestedMode = ORG_DEFAULT_MODE;
  const scopeOrder: { scopeType: string; scopeRef: string | null }[] = [
    { scopeType: "playbook", scopeRef: context.playbookKey ?? null },
    { scopeType: "action", scopeRef: context.actionKey ?? null },
    { scopeType: "org", scopeRef: null },
  ];
  for (const scope of scopeOrder) {
    const { mode: configMode } = await getEffectiveRequestedMode(supabase, context.orgId, scope);
    if (configMode) {
      requestedMode = configMode;
      break;
    }
  }

  if (context.policyBlocked) {
    const result: EffectiveExecutionModeResult = {
      requestedMode,
      effectiveMode: ExecutionMode.SUGGEST_ONLY,
      autonomyConfidenceScore: 0,
      autonomyConfidenceBand: AutonomyConfidenceBand.LOW,
      downgradeReasonCodes: ["policy_blocked"],
      pauseReasonCodes: [],
    };
    await persistDecisionState(supabase, context, result);
    return { data: result, error: null };
  }

  if (context.policyRequiresApproval) {
    downgradeReasonCodes.push("policy_requires_approval");
  }

  const { applied: pauseApplied, effect: pauseEffect } = await resolvePauseEffect(
    supabase,
    context.orgId,
    {
      scopeType: context.scopeType,
      scopeRef: context.scopeRef,
      actionKey: context.actionKey,
      playbookKey: context.playbookKey,
      provider: context.provider,
    }
  );

  if (pauseApplied && pauseEffect) {
    pauseReasonCodes.push(...pauseEffect.reasonCodes);
    const result: EffectiveExecutionModeResult = {
      requestedMode,
      effectiveMode: pauseEffect.effectiveMode,
      autonomyConfidenceScore: 0,
      autonomyConfidenceBand: AutonomyConfidenceBand.LOW,
      downgradeReasonCodes,
      pauseReasonCodes,
    };
    await persistDecisionState(supabase, context, result);
    return { data: result, error: null };
  }

  const confidence = computeAutonomyConfidence(context.confidenceInputs ?? {});
  const downgrade = applyDowngrades(
    requestedMode,
    confidence.band,
    confidence.reasonCodes,
    context.environment,
    context.policyRequiresApproval ? ["policy_requires_approval"] : []
  );

  const result: EffectiveExecutionModeResult = {
    requestedMode,
    effectiveMode: downgrade.effectiveMode,
    autonomyConfidenceScore: confidence.score,
    autonomyConfidenceBand: confidence.band,
    downgradeReasonCodes: [...downgrade.reasonCodes],
    pauseReasonCodes,
  };

  await persistDecisionState(supabase, context, result);
  return { data: result, error: null };
}

async function persistDecisionState(
  supabase: SupabaseClient,
  context: ResolveContext,
  result: EffectiveExecutionModeResult
): Promise<void> {
  await insertAutonomyDecisionState(supabase, {
    orgId: context.orgId,
    issueId: context.issueId,
    workflowRunId: context.workflowRunId,
    actionKey: context.actionKey,
    playbookKey: context.playbookKey,
    requestedMode: result.requestedMode,
    effectiveMode: result.effectiveMode,
    autonomyConfidenceScore: result.autonomyConfidenceScore,
    autonomyConfidenceBand: result.autonomyConfidenceBand,
    downgradeReasonCodes: result.downgradeReasonCodes,
    pauseReasonCodes: result.pauseReasonCodes,
    supportingMetrics: {},
  });
}
