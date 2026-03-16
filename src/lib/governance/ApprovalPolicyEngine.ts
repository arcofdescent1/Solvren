/**
 * Phase A1 — Dynamic Approval Policy Engine
 * Evaluates policies during change submission.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type ChangeContext = {
  changeType?: string;
  impactAmount?: number;
  domain?: string;
  riskBucket?: string;
  riskCategory?: string;
};

export type RequiredApprover = { role: string; minCount: number };

export async function evaluateApprovalPolicies(
  client: SupabaseClient,
  orgId: string,
  context: ChangeContext
): Promise<RequiredApprover[]> {
  const { data: policies } = await client
    .from("approval_policies")
    .select("id")
    .eq("org_id", orgId)
    .eq("enabled", true)
    .order("priority", { ascending: false });

  if (!policies?.length) return [];

  const roles: RequiredApprover[] = [];
  const seen = new Set<string>();

  for (const p of policies) {
    const policyId = (p as { id: string }).id;
    const { data: conditions } = await client
      .from("approval_policy_conditions")
      .select("condition_type, field, operator, value")
      .eq("policy_id", policyId);

    const matches = (conditions ?? []).every((c) => {
      const cond = c as { condition_type: string; field: string; operator: string; value: unknown };
      const fieldVal = getFieldValue(context, cond.field);
      return evaluateCondition(fieldVal, cond.operator, cond.value);
    });

    if (!matches) continue;

    const { data: policyRoles } = await client
      .from("approval_policy_roles")
      .select("required_role, min_count")
      .eq("policy_id", policyId);

    for (const r of policyRoles ?? []) {
      const role = (r as { required_role: string }).required_role;
      const minCount = (r as { min_count: number }).min_count ?? 1;
      const key = `${role}:${minCount}`;
      if (!seen.has(key)) {
        seen.add(key);
        roles.push({ role, minCount });
      }
    }
  }

  return roles;
}

function getFieldValue(ctx: ChangeContext, field: string): unknown {
  switch (field) {
    case "change_type":
      return ctx.changeType;
    case "impact_amount":
      return ctx.impactAmount;
    case "domain":
      return ctx.domain;
    case "risk_bucket":
      return ctx.riskBucket;
    case "risk_category":
      return ctx.riskCategory;
    default:
      return undefined;
  }
}

function evaluateCondition(fieldVal: unknown, operator: string, value: unknown): boolean {
  if (fieldVal === undefined || fieldVal === null) return false;
  switch (operator) {
    case "eq":
      return fieldVal === value;
    case "gt":
      return typeof fieldVal === "number" && typeof value === "number" && fieldVal > value;
    case "gte":
      return typeof fieldVal === "number" && typeof value === "number" && fieldVal >= value;
    case "lt":
      return typeof fieldVal === "number" && typeof value === "number" && fieldVal < value;
    case "in":
      return Array.isArray(value) && value.includes(fieldVal);
    default:
      return false;
  }
}
