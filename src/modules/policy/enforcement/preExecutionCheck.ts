/**
 * Phase 3 — Policy enforcement before action execution (§16).
 * Phase 5 — Thin wrapper over evaluateGovernance (canonical engine + adapters + decision log).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluateGovernance } from "@/modules/governance/governance-engine.service";
import { buildIntegrationActionGovernanceContext } from "@/modules/governance/context-builders";
import { createApprovalRequest } from "../services/policy-engine.service";

export type PreExecutionCheckResult =
  | { allowed: true; governanceTraceId: string }
  | { blocked: true; reason: string; governanceTraceId?: string }
  | { requiresApproval: true; approvalRequestId: string; governanceTraceId: string };

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
  const govCtx = buildIntegrationActionGovernanceContext({
    orgId: ctx.orgId,
    environment: ctx.environment ?? "production",
    actionKey: ctx.actionKey,
    playbookKey: ctx.playbookKey,
    issueId: ctx.issueId,
    impactAmount: ctx.impactAmount ?? null,
    requestedMode: ctx.requestedMode ?? "approve_then_execute",
    actorUserId: ctx.actorUserId ?? null,
    provider: ctx.provider,
  });

  const { policyDecision: decision, policyContext, error } = await evaluateGovernance(supabase, govCtx);

  if (error) {
    return { blocked: true, reason: error.message };
  }

  if (!decision || !policyContext) {
    return { blocked: true, reason: "Policy evaluation failed" };
  }

  const governanceTraceId = decision.evaluationTraceId;

  if (decision.blocked) {
    return { blocked: true, reason: decision.decisionMessage, governanceTraceId };
  }

  if (decision.requiresApproval) {
    const { approvalRequestId } = await createApprovalRequest(supabase, decision, policyContext);
    if (!approvalRequestId) {
      return { blocked: true, reason: "Could not create approval request", governanceTraceId };
    }
    return { requiresApproval: true, approvalRequestId, governanceTraceId };
  }

  return { allowed: true, governanceTraceId };
}
