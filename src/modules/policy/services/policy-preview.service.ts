/**
 * Phase 2 Gap 2 — Policy preview/test (§8.9). Simulates evaluation without persistence.
 */
import type { PolicyEvaluationContext, PolicyRuleMatch } from "../domain";
import type { PolicyDefinition, PolicyRule } from "../domain";
import { evaluateConditionGroup } from "./policy-condition-evaluator";
import { resolveConflict } from "./policy-conflict-resolver.service";

export type PolicyPreviewDraft = {
  displayName?: string;
  policyKey?: string;
  scope?: string;
  scopeRef?: string | null;
  defaultDisposition?: "ALLOW" | "BLOCK";
  rules?: PolicyRule[];
};

function scopeApplies(draft: PolicyPreviewDraft, ctx: PolicyEvaluationContext): boolean {
  const scope = draft.scope ?? "action";
  switch (scope) {
    case "global":
    case "org":
      return true;
    case "action":
      return !draft.scopeRef || ctx.actionKey === draft.scopeRef;
    case "playbook":
      return !draft.scopeRef || ctx.playbookKey === draft.scopeRef;
    case "integration":
      return !draft.scopeRef || ctx.provider === draft.scopeRef;
    default:
      return true;
  }
}

export type PreviewDecision = {
  finalDisposition: "ALLOW" | "BLOCK" | "REQUIRE_APPROVAL";
  requiresApproval: boolean;
  blocked: boolean;
  matchedRules: Array<{ policyKey: string; ruleKey: string; effect: string; reasonCode: string; message: string }>;
  blockedRules: Array<{ ruleKey: string; reasonCode: string }>;
  approvalRules: Array<{ ruleKey: string; approverRoles: string[]; approvalCount: number }>;
};

export function previewPolicy(
  policyDraft: PolicyPreviewDraft,
  evaluationContext: PolicyEvaluationContext
): PreviewDecision {
  const policyDef: PolicyDefinition = {
    policyKey: policyDraft.policyKey ?? "preview",
    displayName: policyDraft.displayName ?? "Preview",
    description: "",
    scope: (policyDraft.scope as PolicyDefinition["scope"]) ?? "action",
    scopeRef: policyDraft.scopeRef ?? undefined,
    priorityOrder: 100,
    status: "active",
    rules: policyDraft.rules ?? [],
    defaultDisposition: (policyDraft.defaultDisposition ?? "BLOCK") as PolicyDefinition["defaultDisposition"],
    effectiveFrom: new Date().toISOString(),
  };

  if (!scopeApplies(policyDraft, evaluationContext)) {
    return {
      finalDisposition: policyDef.defaultDisposition,
      requiresApproval: false,
      blocked: policyDef.defaultDisposition === "BLOCK",
      matchedRules: [],
      blockedRules: [],
      approvalRules: [],
    };
  }

  const matchedRules: Array<{
    policyId: string;
    policyKey: string;
    rule: PolicyRule;
    match: {
      policyId: string;
      policyKey: string;
      ruleKey: string;
      effect: string;
      reasonCode: string;
      message: string;
      hardBlock: boolean;
    };
  }> = [];

  for (const rule of policyDef.rules) {
    if (!evaluateConditionGroup(rule.match, evaluationContext)) continue;
    matchedRules.push({
      policyId: "",
      policyKey: policyDef.policyKey,
      rule,
      match: {
        policyId: "",
        policyKey: policyDef.policyKey,
        ruleKey: rule.ruleKey,
        effect: rule.effect.type,
        reasonCode: "reasonCode" in rule.effect ? rule.effect.reasonCode : "",
        message: "message" in rule.effect ? rule.effect.message : "",
        hardBlock: rule.hardBlock,
      },
    });
  }

  const requestedMode = evaluationContext.requestedMode ?? "approve_then_execute";
  const defaultDisp = policyDef.defaultDisposition === "REQUIRE_APPROVAL" ? "BLOCK" : policyDef.defaultDisposition;
  const resolved = resolveConflict(
    matchedRules as never,
    requestedMode,
    defaultDisp
  );

  return {
    finalDisposition: resolved.finalDisposition,
    requiresApproval: resolved.finalDisposition === "REQUIRE_APPROVAL",
    blocked: resolved.finalDisposition === "BLOCK",
    matchedRules: resolved.matchedRules.map((m: { policyKey: string; ruleKey: string; effect: string; reasonCode: string; message: string }) => ({
      policyKey: m.policyKey,
      ruleKey: m.ruleKey,
      effect: m.effect,
      reasonCode: m.reasonCode,
      message: m.message,
    })),
    blockedRules: resolved.blockedByRules.map((r: PolicyRuleMatch) => ({ ruleKey: r.ruleKey, reasonCode: r.reasonCode })),
    approvalRules: resolved.approvalRules.map((r: PolicyRuleMatch) => {
      const rule = matchedRules.find((m) => m.match.ruleKey === r.ruleKey)?.rule;
      const eff = rule?.effect;
      return {
        ruleKey: r.ruleKey,
        approverRoles: eff?.type === "REQUIRE_APPROVAL" ? eff.approverRoles ?? [] : [],
        approvalCount: eff?.type === "REQUIRE_APPROVAL" ? eff.approvalCount ?? 1 : 0,
      };
    }),
  };
}
