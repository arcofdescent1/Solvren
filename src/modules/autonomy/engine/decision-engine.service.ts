/**
 * Phase 8 — Decision engine (§12).
 * Ranks actions and selects best allowed path.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAction } from "@/modules/execution/registry/action-registry";
import { evaluatePolicy } from "./policy-engine.service";

export type DecisionContext = {
  orgId: string;
  issueId: string;
  playbookKey?: string;
  eligibleActions: string[];
  impactScore?: number;
  confidenceScore?: number;
  amount?: number;
};

export type RankedAction = {
  actionKey: string;
  score: number;
  reason: string;
};

export type DecisionResult = {
  selectedAction: string | null;
  rankedActions: RankedAction[];
  blockedActions: string[];
  requiresApproval: boolean;
  selectionReason: string;
};

export async function rankAndSelectAction(
  supabase: SupabaseClient,
  context: DecisionContext
): Promise<DecisionResult> {
  const policyResult = await evaluatePolicy(supabase, {
    orgId: context.orgId,
    actionKey: undefined,
    playbookKey: context.playbookKey,
    amount: context.amount,
    confidenceScore: context.confidenceScore,
  });

  const blocked = new Set(policyResult.blockedActions);
  const eligible = context.eligibleActions.filter((a) => !blocked.has(a));

  if (eligible.length === 0) {
    return {
      selectedAction: null,
      rankedActions: [],
      blockedActions: [...blocked],
      requiresApproval: true,
      selectionReason: "No eligible actions after policy evaluation",
    };
  }

  const ranked: RankedAction[] = [];
  for (const actionKey of eligible) {
    const def = getAction(actionKey);
    let score = 0.5;
    if (def) {
      if (def.riskLevel === "low") score += 0.2;
      if (def.executionMode === "auto") score += 0.15;
      if ((context.confidenceScore ?? 0) > 0.8) score += 0.1;
    }
    ranked.push({
      actionKey,
      score,
      reason: def ? `${def.displayName} (${def.riskLevel} risk)` : actionKey,
    });
  }

  ranked.sort((a, b) => b.score - a.score);
  const selected = ranked[0]?.actionKey ?? null;

  return {
    selectedAction: selected,
    rankedActions: ranked,
    blockedActions: [...blocked],
    requiresApproval: policyResult.requiresApproval,
    selectionReason: selected ? ranked[0].reason : "No selection",
  };
}
