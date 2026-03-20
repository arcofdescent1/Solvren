/**
 * Phase 6 — Apply routing rules to derive owner (§14).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { listActiveRoutingRules, matchRoutingRule } from "../persistence/routing-rules.repository";

export type ApplyRoutingRulesInput = {
  orgId: string;
  issueId: string;
  domainKey: string;
  sourceType: string;
  severity: string;
};

export type ApplyRoutingRulesResult = {
  ownerType: string;
  ownerRef: string;
  slaPolicyKey: string | null;
  ruleId: string | null;
};

export async function applyRoutingRules(
  supabase: SupabaseClient,
  input: ApplyRoutingRulesInput
): Promise<ApplyRoutingRulesResult> {
  const { data: rules } = await listActiveRoutingRules(supabase, input.orgId);
  const matched = matchRoutingRule(rules, {
    domain_key: input.domainKey,
    source_type: input.sourceType,
    severity: input.severity,
  });

  if (matched) {
    return {
      ownerType: matched.owner_type,
      ownerRef: matched.owner_ref,
      slaPolicyKey: matched.sla_policy_key,
      ruleId: matched.id,
    };
  }

  return {
    ownerType: "unassigned",
    ownerRef: "",
    slaPolicyKey: null,
    ruleId: null,
  };
}
