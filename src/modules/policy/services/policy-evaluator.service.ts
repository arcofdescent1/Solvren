/**
 * Phase 3 — Policy evaluator service (§14.2).
 * Phase 5 — Row metadata (policy id, owner) for governance precedence and audit.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PolicyDefinition,
  PolicyRule,
  PolicyEvaluationContext,
  PolicyRuleMatch,
} from "../domain";
import { evaluateConditionGroup } from "./policy-condition-evaluator";
import { listPolicyRowsForEvaluation, type PolicyRow } from "../repositories/policies.repository";

export type PolicyOwnerType = "PLATFORM" | "ORG";

export type EvaluatedRuleMatch = {
  policyId: string;
  policyKey: string;
  policyOwnerType: PolicyOwnerType;
  policyRelaxationMode: "RELAXABLE" | "NON_RELAXABLE";
  policySource: "canonical" | "revenue_adapter" | "approval_adapter";
  rule: PolicyRule;
  match: PolicyRuleMatch;
};

function rowOwnerMeta(row: PolicyRow): {
  policyOwnerType: PolicyOwnerType;
  policyRelaxationMode: "RELAXABLE" | "NON_RELAXABLE";
} {
  const owner =
    row.policy_owner_type === "PLATFORM" || row.org_id == null ? "PLATFORM" : "ORG";
  const relax =
    row.relaxation_mode === "NON_RELAXABLE" ? "NON_RELAXABLE" : "RELAXABLE";
  return { policyOwnerType: owner, policyRelaxationMode: relax };
}

export async function evaluatePolicies(
  supabase: SupabaseClient,
  orgId: string,
  environment: string,
  context: PolicyEvaluationContext
): Promise<{
  matchedRules: EvaluatedRuleMatch[];
  error: Error | null;
}> {
  void environment;
  const { data: rows, error } = await listPolicyRowsForEvaluation(supabase, orgId);
  if (error) return { matchedRules: [], error };

  const matchedRules: EvaluatedRuleMatch[] = [];
  for (const row of rows) {
    const policy = rowToDefinition(row);
    if (!scopeApplies(policy, context)) continue;
    const { policyOwnerType, policyRelaxationMode } = rowOwnerMeta(row);

    for (const rule of policy.rules) {
      if (!evaluateConditionGroup(rule.match, context)) continue;

      const match: PolicyRuleMatch = {
        policyId: row.id,
        policyKey: policy.policyKey,
        ruleKey: rule.ruleKey,
        effect: rule.effect.type,
        reasonCode:
          "reasonCode" in rule.effect ? rule.effect.reasonCode : "",
        message: "message" in rule.effect ? rule.effect.message : "",
        hardBlock: rule.hardBlock,
      };
      matchedRules.push({
        policyId: row.id,
        policyKey: policy.policyKey,
        policyOwnerType,
        policyRelaxationMode,
        policySource: "canonical",
        rule,
        match,
      });
    }
  }

  return { matchedRules, error: null };
}

function rowToDefinition(row: PolicyRow): PolicyDefinition {
  return {
    policyKey: row.policy_key,
    displayName: row.display_name,
    description: row.description,
    scope: row.scope as PolicyDefinition["scope"],
    scopeRef: row.scope_ref ?? undefined,
    priorityOrder: row.priority_order,
    status: row.status as PolicyDefinition["status"],
    rules: (row.rules_json ?? []) as PolicyDefinition["rules"],
    defaultDisposition: row.default_disposition as PolicyDefinition["defaultDisposition"],
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to ?? undefined,
  };
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
