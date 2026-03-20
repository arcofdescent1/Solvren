/**
 * Phase 5 — Decision engine service (§20.1).
 * Orchestrates filtering, scoring, tie-breaking, explanation, logging.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DecisionContext } from "../domain/decision-context";
import type { DecisionResult } from "../domain/decision-result";
import type { RankedAction } from "../domain/ranked-action";
import { filterCandidateActions } from "./candidate-action-filter.service";
import {
  computeFeatureBreakdown,
  type NormalizationRules,
} from "./feature-normalization.service";
import { computeWeightedScore, type ScoringWeights } from "./action-scoring.service";
import { sortRankedActions, assignRanks } from "./tie-break.service";
import { shouldUseColdStart } from "./cold-start.service";
import {
  buildExplanationForRankedAction,
} from "./decision-explainer.service";
import { getActiveDecisionModel } from "../repositories/decision-models.repository";
import { getActionPerformanceStatsBatch } from "../repositories/action-performance-stats.repository";
import { insertDecisionLog } from "../repositories/decision-logs.repository";
import { getAction } from "@/modules/execution/registry/action-registry";
import { createHash } from "node:crypto";

function validateContext(ctx: DecisionContext): string | null {
  if (!ctx.orgId || !ctx.environment) return "orgId and environment required";
  const hasRef = ctx.issueId || ctx.findingId || ctx.workflowRunId;
  if (!hasRef) return "One of issueId, findingId, or workflowRunId required";
  if (!Array.isArray(ctx.candidateActionKeys) || ctx.candidateActionKeys.length === 0)
    return "candidateActionKeys required and must be non-empty";
  if (!ctx.requestedMode) return "requestedMode required";
  return null;
}

function computeContextHash(ctx: DecisionContext): string {
  const payload = JSON.stringify({
    orgId: ctx.orgId,
    environment: ctx.environment,
    issueId: ctx.issueId,
    findingId: ctx.findingId,
    workflowRunId: ctx.workflowRunId,
    issueFamily: ctx.issueFamily,
    severity: ctx.severity,
    priorityBand: ctx.priorityBand,
    impactAmount: ctx.impactAmount,
    impactScore: ctx.impactScore,
    confidenceScore: ctx.confidenceScore,
    requestedMode: ctx.requestedMode,
    candidateActionKeys: [...ctx.candidateActionKeys].sort(),
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

export async function rankActions(
  supabase: SupabaseClient,
  context: DecisionContext
): Promise<{ data: DecisionResult; error: Error | null }> {
  const err = validateContext(context);
  if (err) return { data: null as unknown as DecisionResult, error: new Error(err) };

  const traceId = crypto.randomUUID();
  const contextHash = computeContextHash(context);

  const { data: model, error: modelError } = await getActiveDecisionModel(
    supabase,
    "default_action_ranking",
    context.issueFamily
  );

  if (modelError || !model) {
    return {
      data: {
        resultStatus: "ERROR",
        selectedActionKey: null,
        rankedActions: [],
        blockedActions: [],
        ineligibleActions: [],
        usedColdStart: false,
        decisionModelKey: "default_action_ranking",
        decisionModelVersion: "1.0.0",
        contextHash,
        decisionTraceId: traceId,
      },
      error: modelError ?? new Error("No active decision model found"),
    };
  }

  const weights = model.weights_json as ScoringWeights;
  const normRules = model.normalization_rules_json as NormalizationRules;
  const fallbackRules = model.fallback_rules_json as { coldStartMinSampleOrgFamily?: number; coldStartMinSampleOrg?: number };

  const { eligible, blocked, ineligible } = await filterCandidateActions(supabase, context);

  const blockedActions = blocked.map((b) => ({
    actionKey: b.actionKey,
    reasonCode: b.reasonCode,
    reasonText: b.reasonText,
  }));
  const ineligibleActions = ineligible.map((i) => ({
    actionKey: i.actionKey,
    reasonCode: i.reasonCode,
    reasonText: i.reasonText,
  }));

  if (eligible.length === 0) {
    const result: DecisionResult = {
      resultStatus: "NO_ELIGIBLE_ACTION",
      selectedActionKey: null,
      rankedActions: [],
      blockedActions,
      ineligibleActions,
      usedColdStart: false,
      decisionModelKey: model.model_key,
      decisionModelVersion: model.model_version,
      contextHash,
      decisionTraceId: traceId,
    };
    await insertDecisionLog(supabase, {
      org_id: context.orgId,
      issue_id: context.issueId ?? null,
      finding_id: context.findingId ?? null,
      workflow_run_id: context.workflowRunId ?? null,
      decision_model_id: model.id,
      decision_model_key: model.model_key,
      decision_model_version: model.model_version,
      context_json: context as unknown as Record<string, unknown>,
      candidate_actions_json: context.candidateActionKeys,
      blocked_actions_json: blockedActions,
      ineligible_actions_json: ineligibleActions,
      ranked_actions_json: [],
      selected_action_key: null,
      used_cold_start: false,
      result_status: "NO_ELIGIBLE_ACTION",
      context_hash: contextHash,
    });
    return { data: result, error: null };
  }

  const actionKeys = eligible.map((e) => e.actionKey);
  const statsMap = await getActionPerformanceStatsBatch(
    supabase,
    context.orgId,
    actionKeys,
    context.issueFamily
  );

  const usedColdStart = shouldUseColdStart(
    context.orgId,
    context.issueFamily,
    statsMap,
    fallbackRules
  );

  type PartialRanked = Omit<RankedAction, "explanationCodes" | "explanationText" | "rank"> & {
    rank: number;
    fallbackCodes: string[];
    displayName: string;
  };
  const partials: PartialRanked[] = [];
  for (const e of eligible) {
    const stats = statsMap.get(e.actionKey) ?? null;
    const { fallbackCodes, ...breakdown } = computeFeatureBreakdown(
      context,
      e,
      stats,
      e.approvalRequired,
      normRules
    );
    const weightedScore = computeWeightedScore(breakdown, weights);
    const def = getAction(e.actionKey);
    const displayName = def?.displayName ?? e.actionKey;

    partials.push({
      actionKey: e.actionKey,
      provider: e.provider ?? null,
      weightedScore,
      rank: 0,
      approvalRequired: e.approvalRequired,
      effectiveAutonomyMode: context.requestedMode,
      featureBreakdown: breakdown,
      fallbackCodes,
      displayName,
    });
  }

  const sortable = partials.map((p) => ({
    ...p,
    explanationCodes: [] as string[],
    explanationText: "",
  }));
  const sorted = sortRankedActions(sortable as RankedAction[]);
  const withRanks = assignRanks(sorted);

  const ranked: RankedAction[] = withRanks.map((r) => {
    const p = partials.find((x) => x.actionKey === r.actionKey)!;
    const explained = buildExplanationForRankedAction(
      { ...r, rank: r.rank },
      p.fallbackCodes,
      usedColdStart,
      p.displayName
    );
    return { ...r, ...explained };
  });

  const selectedActionKey = withRanks[0]?.actionKey ?? null;

  const result: DecisionResult = {
    resultStatus: "RANKED",
    selectedActionKey,
    rankedActions: ranked,
    blockedActions,
    ineligibleActions,
    usedColdStart,
    decisionModelKey: model.model_key,
    decisionModelVersion: model.model_version,
    contextHash,
    decisionTraceId: traceId,
  };

  const topAction = ranked[0];
  await insertDecisionLog(supabase, {
    org_id: context.orgId,
    issue_id: context.issueId ?? null,
    finding_id: context.findingId ?? null,
    workflow_run_id: context.workflowRunId ?? null,
    decision_model_id: model.id,
    decision_model_key: model.model_key,
    decision_model_version: model.model_version,
    context_json: context as unknown as Record<string, unknown>,
    candidate_actions_json: context.candidateActionKeys,
    blocked_actions_json: blockedActions,
    ineligible_actions_json: ineligibleActions,
    ranked_actions_json: ranked,
    selected_action_key: selectedActionKey,
    used_cold_start: usedColdStart,
    result_status: "RANKED",
    context_hash: contextHash,
    selection_reason_json: {
      explanationText: topAction?.explanationText,
      explanationCodes: topAction?.explanationCodes,
    },
    confidence_score: topAction?.featureBreakdown.confidenceNorm ?? 0,
    requires_approval: topAction?.approvalRequired ?? false,
  });

  return { data: result, error: null };
}

export async function rankSingleBestAction(
  supabase: SupabaseClient,
  context: DecisionContext
): Promise<{ data: DecisionResult; error: Error | null }> {
  return rankActions(supabase, context);
}

export async function getDecisionLog(
  supabase: SupabaseClient,
  decisionTraceId: string
): Promise<{ data: DecisionResult | null; error: Error | null }> {
  const { getDecisionLogByTraceId } = await import(
    "../repositories/decision-logs.repository"
  );
  const { data: row, error } = await getDecisionLogByTraceId(
    supabase,
    decisionTraceId
  );
  if (error || !row) return { data: null, error: error ?? null };

  const result: DecisionResult = {
    resultStatus: (row.result_status as DecisionResult["resultStatus"]) ?? "RANKED",
    selectedActionKey: row.selected_action_key,
    rankedActions: (row.ranked_actions_json as RankedAction[]) ?? [],
    blockedActions: (row.blocked_actions_json as DecisionResult["blockedActions"]) ?? [],
    ineligibleActions: (row.ineligible_actions_json as DecisionResult["ineligibleActions"]) ?? [],
    usedColdStart: row.used_cold_start ?? false,
    decisionModelKey: row.decision_model_key ?? "default_action_ranking",
    decisionModelVersion: row.decision_model_version ?? "1.0.0",
    contextHash: row.context_hash ?? "",
    decisionTraceId: row.id,
  };
  return { data: result, error: null };
}
