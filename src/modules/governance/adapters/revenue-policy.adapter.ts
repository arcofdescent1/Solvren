/**
 * Phase 5 — Read-time adapter: revenue_policies → canonical rule matches (no standalone enforcement).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PolicyRule } from "@/modules/policy/domain";
import type { PolicyEvaluationContext } from "@/modules/policy/domain";
import type { EvaluatedRuleMatch } from "@/modules/policy/services/policy-evaluator.service";

type RevenuePolicyRow = {
  id: string;
  org_id: string;
  name: string | null;
  rule_type: string;
  rule_config: Record<string, unknown> | null;
  systems_affected: string[] | null;
  enforcement_mode: string;
  priority: number;
};

const emptyMatch = (): PolicyRule["match"] => ({
  operator: "AND",
  conditions: [],
});

export async function fetchRevenuePolicyAdapterMatches(
  supabase: SupabaseClient,
  orgId: string,
  context: PolicyEvaluationContext
): Promise<EvaluatedRuleMatch[]> {
  const meta = context.metadata;
  const resourceType =
    meta && typeof meta === "object" && "governanceResourceType" in meta
      ? String((meta as { governanceResourceType?: string }).governanceResourceType ?? "")
      : "";

  if (resourceType !== "change" && resourceType !== "integration_action") {
    return [];
  }

  const { data, error } = await supabase
    .from("revenue_policies")
    .select(
      "id, org_id, name, rule_type, rule_config, systems_affected, enforcement_mode, priority"
    )
    .eq("org_id", orgId)
    .eq("enabled", true)
    .order("priority", { ascending: false });

  if (error) return [];

  const provider = context.provider ?? "";
  const out: EvaluatedRuleMatch[] = [];

  for (const row of (data ?? []) as RevenuePolicyRow[]) {
    const systems = row.systems_affected ?? [];
    if (
      resourceType === "integration_action" &&
      systems.length > 0 &&
      provider &&
      !systems.includes(provider) &&
      !systems.includes("*")
    ) {
      continue;
    }

    const mode = (row.enforcement_mode ?? "MONITOR").toUpperCase();
    if (mode === "MONITOR") continue;

    const base = {
      policyId: `revenue_adapter:${row.id}`,
      policyKey: `revenue_policy:${row.id}`,
      policyOwnerType: "ORG" as const,
      policyRelaxationMode: "RELAXABLE" as const,
      policySource: "revenue_adapter" as const,
    };

    if (mode === "BLOCK") {
      const rule: PolicyRule = {
        ruleKey: `revenue:${row.id}:block`,
        description: row.name ?? "Revenue policy",
        match: emptyMatch(),
        effect: {
          type: "BLOCK",
          reasonCode: `revenue_policy_${row.rule_type}`,
          message: row.name ?? "Blocked by revenue policy",
        },
        hardBlock: false,
        exceptionEligible: true,
      };
      out.push({
        ...base,
        rule,
        match: {
          policyId: base.policyId,
          policyKey: base.policyKey,
          ruleKey: rule.ruleKey,
          effect: "BLOCK",
          reasonCode: rule.effect.reasonCode,
          message: rule.effect.message,
          hardBlock: false,
        },
      });
    } else if (mode === "REQUIRE_APPROVAL") {
      const cfg = row.rule_config ?? {};
      const rolesRaw = cfg.approverRoles ?? cfg.required_roles;
      const approverRoles = Array.isArray(rolesRaw)
        ? (rolesRaw as string[]).filter(Boolean)
        : typeof rolesRaw === "string"
          ? [rolesRaw]
          : ["finance_approver"];
      const rule: PolicyRule = {
        ruleKey: `revenue:${row.id}:approval`,
        description: row.name ?? "Revenue policy",
        match: emptyMatch(),
        effect: {
          type: "REQUIRE_APPROVAL",
          reasonCode: `revenue_policy_${row.rule_type}`,
          message: row.name ?? "Revenue policy requires approval",
          approverRoles: approverRoles.length ? approverRoles : ["finance_approver"],
          approvalCount: Number(cfg.approvalCount ?? cfg.quorum ?? 1) || 1,
        },
        hardBlock: false,
        exceptionEligible: true,
      };
      out.push({
        ...base,
        rule,
        match: {
          policyId: base.policyId,
          policyKey: base.policyKey,
          ruleKey: rule.ruleKey,
          effect: "REQUIRE_APPROVAL",
          reasonCode: rule.effect.reasonCode,
          message: rule.effect.message,
          hardBlock: false,
        },
      });
    }
  }

  return out;
}
