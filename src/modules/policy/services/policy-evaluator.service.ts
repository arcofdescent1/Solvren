/**
 * Phase 3 — Policy evaluator service (§14.2).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PolicyDefinition,
  PolicyRule,
  PolicyEvaluationContext,
  PolicyRuleMatch,
} from "../domain";
import { evaluateConditionGroup } from "./policy-condition-evaluator";
import { listPoliciesForEvaluation } from "../repositories/policies.repository";

export type EvaluatedRuleMatch = {
  policyId: string;
  policyKey: string;
  rule: PolicyRule;
  match: PolicyRuleMatch;
};

export async function evaluatePolicies(
  supabase: SupabaseClient,
  orgId: string,
  environment: string,
  context: PolicyEvaluationContext
): Promise<{
  matchedRules: EvaluatedRuleMatch[];
  error: Error | null;
}> {
  const { data: policies, error } = await listPoliciesForEvaluation(supabase, orgId, environment);
  if (error) return { matchedRules: [], error };

  const matchedRules: EvaluatedRuleMatch[] = [];
  for (const policy of policies) {
    if (!scopeApplies(policy, context)) continue;

    for (const rule of policy.rules) {
      if (!evaluateConditionGroup(rule.match, context)) continue;

      const match: PolicyRuleMatch = {
        policyId: "",
        policyKey: policy.policyKey,
        ruleKey: rule.ruleKey,
        effect: rule.effect.type,
        reasonCode:
          "reasonCode" in rule.effect ? rule.effect.reasonCode : "",
        message: "message" in rule.effect ? rule.effect.message : "",
        hardBlock: rule.hardBlock,
      };
      matchedRules.push({
        policyId: "",
        policyKey: policy.policyKey,
        rule,
        match,
      });
    }
  }

  return { matchedRules, error: null };
}

function scopeApplies(policy: PolicyDefinition, ctx: PolicyEvaluationContext): boolean {
  switch (policy.scope) {
    case "global":
      return true;
    case "org":
      return true;
    case "environment":
      return true;
    case "integration":
      return !policy.scopeRef || ctx.integrationId === policy.scopeRef || ctx.provider === policy.scopeRef;
    case "action":
      return !policy.scopeRef || ctx.actionKey === policy.scopeRef;
    case "playbook":
      return !policy.scopeRef || ctx.playbookKey === policy.scopeRef;
    case "issue_family":
      return !policy.scopeRef || ctx.issueFamily === policy.scopeRef;
    case "risk_class":
      return !policy.scopeRef || ctx.riskLevel === policy.scopeRef;
    default:
      return false;
  }
}
