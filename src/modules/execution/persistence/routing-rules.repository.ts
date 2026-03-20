/**
 * Phase 6 — routing_rules persistence (§14).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type RoutingRuleRow = {
  id: string;
  org_id: string;
  domain_key: string;
  source_type: string | null;
  severity_min: string | null;
  conditions_json: Record<string, unknown>;
  owner_type: string;
  owner_ref: string;
  sla_policy_key: string | null;
  escalation_policy_json: Record<string, unknown> | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

const SEVERITY_ORDER = ["low", "medium", "high", "critical"] as const;

function severityMeetsMin(issueSeverity: string, minSeverity: string | null): boolean {
  if (!minSeverity) return true;
  const issueIdx = SEVERITY_ORDER.indexOf(issueSeverity as (typeof SEVERITY_ORDER)[number]);
  const minIdx = SEVERITY_ORDER.indexOf(minSeverity as (typeof SEVERITY_ORDER)[number]);
  if (issueIdx < 0 || minIdx < 0) return true;
  return issueIdx >= minIdx;
}

export async function listActiveRoutingRules(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ data: RoutingRuleRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("routing_rules")
    .select("*")
    .eq("org_id", orgId)
    .eq("active", true)
    .order("domain_key");
  return { data: (data ?? []) as RoutingRuleRow[], error: error as Error | null };
}

export function matchRoutingRule(
  rules: RoutingRuleRow[],
  issue: { domain_key: string; source_type: string; severity: string }
): RoutingRuleRow | null {
  for (const rule of rules) {
    if (rule.domain_key !== issue.domain_key && rule.domain_key !== "*") continue;
    if (rule.source_type != null && rule.source_type !== "" && rule.source_type !== issue.source_type) continue;
    if (!severityMeetsMin(issue.severity, rule.severity_min)) continue;
    return rule;
  }
  return null;
}
