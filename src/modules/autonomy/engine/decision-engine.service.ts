/**
 * Phase 8 — Decision engine (§12).
 * Ranks actions and selects best allowed path.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAction } from "@/modules/execution/registry/action-registry";
import { getOrgAutonomySettings } from "../persistence/policies.repository";
import { evaluateGovernance, deploymentGovernanceEnvironment } from "@/modules/governance";

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
  const { data: autonomySettings } = await getOrgAutonomySettings(supabase, context.orgId);
  if (autonomySettings?.automation_paused) {
    return {
      selectedAction: null,
      rankedActions: [],
      blockedActions: [...context.eligibleActions],
      requiresApproval: true,
      selectionReason: "Automation paused for org",
    };
  }

  const blocked = new Set<string>();
  let requiresApproval = false;

  for (const actionKey of context.eligibleActions) {
    const { data: gov, error } = await evaluateGovernance(
      supabase,
      {
        orgId: context.orgId,
        environment: deploymentGovernanceEnvironment(),
        actor: { actorType: "automation" },
        target: {
          resourceType: "integration_action",
          actionKey,
        },
        issue: {
          issueId: context.issueId,
          impactAmount: context.amount,
          confidence: context.confidenceScore,
        },
        autonomy: { requestedMode: "AUTO" },
        extensions: context.playbookKey ? { playbookKey: context.playbookKey } : undefined,
      },
      { persistDecisionLog: false }
    );

    if (error) {
      blocked.add(actionKey);
      continue;
    }
    if (gov?.disposition === "BLOCK") {
      blocked.add(actionKey);
      continue;
    }
    if (gov?.disposition === "REQUIRE_APPROVAL") {
      requiresApproval = true;
    }
  }

  const eligible = context.eligibleActions.filter((a) => !blocked.has(a));

  if (eligible.length === 0) {
    return {
      selectedAction: null,
      rankedActions: [],
      blockedActions: [...blocked],
      requiresApproval: true,
      selectionReason: "No eligible actions after governance evaluation",
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
    requiresApproval,
    selectionReason: selected ? ranked[0].reason : "No selection",
  };
}
