/**
 * Phase 8 — Policy engine (§10).
 * Evaluates policies to determine allowed/blocked actions and required approval mode.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { listActivePolicies, getOrgAutonomySettings } from "../persistence/policies.repository";

export type PolicyEvaluationContext = {
  orgId: string;
  actionKey?: string;
  playbookKey?: string;
  issueFamily?: string;
  amount?: number;
  confidenceScore?: number;
};

export type PolicyEvaluationResult = {
  allowed: boolean;
  blocked: boolean;
  blockedReason?: string;
  allowedActions: string[];
  blockedActions: string[];
  requiredAutonomyMode: string;
  requiresApproval: boolean;
  automationPaused: boolean;
};

export async function evaluatePolicy(
  supabase: SupabaseClient,
  context: PolicyEvaluationContext
): Promise<PolicyEvaluationResult> {
  const { data: settings } = await getOrgAutonomySettings(supabase, context.orgId);
  const automationPaused = settings?.automation_paused ?? false;

  if (automationPaused) {
    return {
      allowed: false,
      blocked: true,
      blockedReason: "Automation paused for org",
      allowedActions: [],
      blockedActions: context.actionKey ? [context.actionKey] : [],
      requiredAutonomyMode: "manual_only",
      requiresApproval: true,
      automationPaused: true,
    };
  }

  const { data: policies } = await listActivePolicies(supabase, context.orgId);

  const blockedActions: string[] = [];
  const allowedActions: string[] = [];
  let requiresApproval = false;
  let requiredAutonomyMode = "approve_then_execute";
  let blockedReason: string | undefined;

  for (const p of policies ?? []) {
    const rules = (p.policy_rules_json ?? {}) as Record<string, unknown>;
    const blocked = (rules.blocked_actions as string[]) ?? [];
    const allowed = (rules.allowed_actions as string[]) ?? [];
    const mode = (p.autonomy_mode as string) ?? "approve_then_execute";

    if (context.actionKey && blocked.some((b) => context.actionKey!.includes(b) || context.actionKey === b)) {
      blockedActions.push(context.actionKey);
      blockedReason = `Policy ${p.policy_key}: action blocked`;
    }
    if (context.actionKey && allowed.length > 0 && allowed.some((a) => context.actionKey!.includes(a))) {
      allowedActions.push(context.actionKey);
    }

    const threshold = rules.financial_threshold as number | undefined;
    if (threshold != null && (context.amount ?? 0) > threshold) {
      requiresApproval = true;
      blockedReason = blockedReason ?? `Amount exceeds threshold $${threshold}`;
    }

    const modeOrder = ["manual_only", "suggest_only", "approve_then_execute", "auto_execute_low_risk", "auto_execute_policy_bounded", "full_trusted_autonomy"];
    const modeIdx = modeOrder.indexOf(mode);
    const currentIdx = modeOrder.indexOf(requiredAutonomyMode);
    if (modeIdx >= 0 && (currentIdx < 0 || modeIdx < currentIdx)) {
      requiredAutonomyMode = mode;
    }
  }

  const blocked = context.actionKey ? blockedActions.includes(context.actionKey) : false;
  const allowed = !blocked && (allowedActions.length > 0 || blockedActions.length === 0);

  return {
    allowed,
    blocked,
    blockedReason,
    allowedActions: allowedActions.length ? allowedActions : (context.actionKey ? [context.actionKey] : []),
    blockedActions,
    requiredAutonomyMode,
    requiresApproval: requiresApproval || requiredAutonomyMode === "manual_only" || requiredAutonomyMode === "suggest_only",
    automationPaused,
  };
}
