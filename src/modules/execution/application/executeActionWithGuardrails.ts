/**
 * Phase 6 Deep Expansion — Execution engine with approval guardrails (§14).
 * DETECT → QUANTIFY → ROUTE → EXECUTE → VERIFY
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAction } from "../registry/action-registry";
/** Check if action requires human approval per org policy. */
export async function requiresApproval(
  supabase: SupabaseClient,
  orgId: string,
  actionKey: string,
  riskLevel: string
): Promise<boolean> {
  const def = getAction(actionKey);
  if (!def) return true; // Unknown action → require approval
  if (def.requiresApproval) return true;

  const { data: policy } = await supabase
    .from("org_approval_policies")
    .select("risk_level_threshold, requires_human, blocked_actions")
    .eq("org_id", orgId)
    .maybeSingle();

  if (!policy) return def.riskLevel === "high" || def.riskLevel === "critical";

  const blocked = (policy.blocked_actions as string[]) ?? [];
  if (blocked.includes(actionKey) || blocked.some((b) => actionKey.endsWith(`.${b}`))) {
    return true;
  }

  const threshold = policy.risk_level_threshold as string;
  const order = ["low", "medium", "high", "critical"];
  const riskIdx = order.indexOf(riskLevel);
  const threshIdx = order.indexOf(threshold);
  if (riskIdx >= 0 && threshIdx >= 0 && riskIdx >= threshIdx && policy.requires_human) {
    return true;
  }

  return false;
}
