/**
 * Phase 5 — Read-time adapter: approval_policies + conditions + roles → canonical REQUIRE_APPROVAL matches.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PolicyRule } from "@/modules/policy/domain";
import type { PolicyEvaluationContext } from "@/modules/policy/domain";
import type { EvaluatedRuleMatch } from "@/modules/policy/services/policy-evaluator.service";

type ConditionRow = {
  condition_type: string;
  field: string;
  operator: string;
  value: unknown;
};

function conditionMatches(row: ConditionRow, ctx: PolicyEvaluationContext): boolean {
  const field = row.field;
  const op = (row.operator ?? "EQ").toUpperCase();
  const expected = row.value;

  const envMap: Record<string, unknown> = {
    environment: ctx.environment,
    actionKey: ctx.actionKey,
    playbookKey: ctx.playbookKey,
    riskLevel: ctx.riskLevel,
    provider: ctx.provider,
    impactAmount: ctx.impactAmount,
  };

  const meta =
    ctx.metadata && typeof ctx.metadata === "object"
      ? (ctx.metadata as Record<string, unknown>)
      : {};
  if (field === "change.domain") {
    const actual = meta.changeDomain;
    if (op === "EQ") return String(actual ?? "") === String(expected ?? "");
    if (op === "IN" && Array.isArray(expected)) {
      return expected.map(String).includes(String(actual ?? ""));
    }
    return false;
  }

  if (field === "governance.transitionKey") {
    const actual = meta.transitionKey;
    if (op === "EQ") return String(actual ?? "") === String(expected ?? "");
    return false;
  }

  const actual = envMap[field];
  if (actual === undefined && !Object.prototype.hasOwnProperty.call(envMap, field)) {
    return false;
  }

  switch (op) {
    case "EQ":
      return String(actual ?? "") === String(expected ?? "");
    case "NEQ":
      return String(actual ?? "") !== String(expected ?? "");
    case "IN":
      return Array.isArray(expected) && (expected as unknown[]).map(String).includes(String(actual ?? ""));
    case "GTE":
      return Number(actual ?? 0) >= Number(expected ?? 0);
    case "LTE":
      return Number(actual ?? 0) <= Number(expected ?? 0);
    default:
      return false;
  }
}

function approvalConditionsMatch(conds: ConditionRow[], ctx: PolicyEvaluationContext): boolean {
  if (!conds.length) return false;
  return conds.every((c) => conditionMatches(c, ctx));
}

export async function fetchApprovalPolicyAdapterMatches(
  supabase: SupabaseClient,
  orgId: string,
  context: PolicyEvaluationContext
): Promise<EvaluatedRuleMatch[]> {
  const { data: policies, error } = await supabase
    .from("approval_policies")
    .select("id, name, priority, enabled")
    .eq("org_id", orgId)
    .eq("enabled", true)
    .order("priority", { ascending: false });

  if (error || !policies?.length) return [];

  const out: EvaluatedRuleMatch[] = [];

  for (const pol of policies) {
    const { data: conds } = await supabase
      .from("approval_policy_conditions")
      .select("condition_type, field, operator, value")
      .eq("policy_id", pol.id);

    const { data: roles } = await supabase
      .from("approval_policy_roles")
      .select("required_role, min_count")
      .eq("policy_id", pol.id);

    if (!approvalConditionsMatch((conds ?? []) as ConditionRow[], context)) continue;

    const approverRoles = [...new Set((roles ?? []).map((r) => r.required_role).filter(Boolean))];
    let quorum = 1;
    for (const r of roles ?? []) {
      quorum = Math.max(quorum, Number((r as { min_count?: number }).min_count ?? 1));
    }

    const rule: PolicyRule = {
      ruleKey: `approval_adapter:${pol.id}`,
      description: (pol as { name?: string }).name ?? "Approval policy",
      match: { operator: "AND", conditions: [] },
      effect: {
        type: "REQUIRE_APPROVAL",
        reasonCode: "approval_policy_adapter",
        message: (pol as { name?: string }).name ?? "Dynamic approval policy",
        approverRoles: approverRoles.length ? approverRoles : ["org_admin"],
        approvalCount: quorum,
      },
      hardBlock: false,
      exceptionEligible: true,
    };

    out.push({
      policyId: `approval_adapter:${pol.id}`,
      policyKey: `approval_policy:${pol.id}`,
      policyOwnerType: "ORG",
      policyRelaxationMode: "RELAXABLE",
      policySource: "approval_adapter",
      rule,
      match: {
        policyId: `approval_adapter:${pol.id}`,
        policyKey: `approval_policy:${pol.id}`,
        ruleKey: rule.ruleKey,
        effect: "REQUIRE_APPROVAL",
        reasonCode: rule.effect.reasonCode,
        message: rule.effect.message,
        hardBlock: false,
      },
    });
  }

  return out;
}
