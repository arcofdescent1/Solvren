/**
 * Phase 3 — Policy enforcement before action execution (§16).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluate, createApprovalRequest } from "../services/policy-engine.service";
import { PolicyBlockedError } from "../errors";

export type PreExecutionCheckResult =
  | { allowed: true }
  | { blocked: true; reason: string }
  | { requiresApproval: true; approvalRequestId: string };

export async function preExecutionCheck(
  supabase: SupabaseClient,
  ctx: {
    orgId: string;
    environment?: "production" | "staging" | "sandbox" | "demo" | "internal";
    actionKey: string;
    playbookKey?: string;
    issueId?: string;
    impactAmount?: number | null;
    requestedMode?: string;
    actorUserId?: string | null;
    provider?: string;
  }
): Promise<PreExecutionCheckResult> {
  const { data: decision, error } = await evaluate(supabase, {
    orgId: ctx.orgId,
    environment: ctx.environment ?? "production",
    actionKey: ctx.actionKey,
    playbookKey: ctx.playbookKey,
    issueId: ctx.issueId,
    impactAmount: ctx.impactAmount ?? null,
    requestedMode: (ctx.requestedMode as "approve_then_execute" | "auto_execute_low_risk" | "manual_only") ?? "approve_then_execute",
    actorUserId: ctx.actorUserId ?? null,
    provider: ctx.provider,
  });

  if (error) {
    return { blocked: true, reason: error.message };
  }

  if (!decision) {
    return { blocked: true, reason: "Policy evaluation failed" };
  }

  if (decision.blocked) {
    return { blocked: true, reason: decision.decisionMessage };
  }

  if (decision.requiresApproval) {
    const { approvalRequestId } = await createApprovalRequest(supabase, decision, {
      orgId: ctx.orgId,
      environment: ctx.environment ?? "production",
      actionKey: ctx.actionKey,
      playbookKey: ctx.playbookKey,
      issueId: ctx.issueId,
      impactAmount: ctx.impactAmount ?? null,
      requestedMode: (ctx.requestedMode as "approve_then_execute") ?? "approve_then_execute",
      actorUserId: ctx.actorUserId ?? null,
      provider: ctx.provider,
    });
    if (!approvalRequestId) {
      return { blocked: true, reason: "Could not create approval request" };
    }
    return { requiresApproval: true, approvalRequestId };
  }

  return { allowed: true };
}
