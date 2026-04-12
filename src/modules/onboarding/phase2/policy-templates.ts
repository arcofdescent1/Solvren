/**
 * Phase 2 — starter policies persisted into public.policies (Option A).
 */
import type { PolicyRule } from "@/modules/policy/domain";

export const ACTIVATION_POLICY_KEY_PREFIX = "activation_tpl_" as const;

export type ActivationPolicyTemplateKey =
  | "revenue_impact_requires_director_approval"
  | "forecast_drop_escalates_to_exec"
  | "integration_failure_requires_it_ack";

const baseRule = (suffix: string, message: string, roles: string[]): PolicyRule => ({
  ruleKey: `activation_rule_${suffix}`,
  description: message,
  match: {
    operator: "AND",
    conditions: [{ field: "impactAmount", operator: "GTE", value: 1 }],
  },
  effect: {
    type: "REQUIRE_APPROVAL",
    reasonCode: `activation_${suffix}`,
    message,
    approverRoles: roles,
    approvalCount: 1,
  },
  hardBlock: false,
});

export const ACTIVATION_POLICY_TEMPLATES: Record<
  ActivationPolicyTemplateKey,
  { policyKey: string; displayName: string; description: string; rules: PolicyRule[] }
> = {
  revenue_impact_requires_director_approval: {
    policyKey: `${ACTIVATION_POLICY_KEY_PREFIX}revenue_impact_director`,
    displayName: "Revenue impact — director approval",
    description: "Revenue-impacting changes require director-level approval before execution.",
    rules: [baseRule("rev_director", "Revenue-impacting change requires director approval.", ["admin"])],
  },
  forecast_drop_escalates_to_exec: {
    policyKey: `${ACTIVATION_POLICY_KEY_PREFIX}forecast_drop_exec`,
    displayName: "Forecast decrease — executive visibility",
    description: "Material forecast decreases escalate for executive review.",
    rules: [baseRule("forecast_exec", "Forecast decrease triggers executive escalation path.", ["admin"])],
  },
  integration_failure_requires_it_ack: {
    policyKey: `${ACTIVATION_POLICY_KEY_PREFIX}integration_it_ack`,
    displayName: "Integration failure — IT acknowledgement",
    description: "High-risk integration failures require IT acknowledgement.",
    rules: [baseRule("integration_it", "Integration failure requires IT acknowledgement.", ["admin"])],
  },
};
