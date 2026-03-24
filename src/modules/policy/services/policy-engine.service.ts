/**
 * Phase 3 — Policy engine service (§14.1). Single enforcement point.
 * Phase 5 — Legacy adapters, exception eligibility, optional log persistence.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PolicyEvaluationContext, PolicyDecision } from "../domain";
import { evaluatePolicies } from "./policy-evaluator.service";
import { resolveConflict } from "./policy-conflict-resolver.service";
import { getApplicableExceptions } from "./policy-exception.service";
import { insertPolicyDecisionLog } from "../repositories/policy-decision-logs.repository";
import { insertApprovalRequest } from "../repositories/approval-requests.repository";
import { fetchRevenuePolicyAdapterMatches } from "@/modules/governance/adapters/revenue-policy.adapter";
import { fetchApprovalPolicyAdapterMatches } from "@/modules/governance/adapters/approval-policy.adapter";

const DEFAULT_REQUESTED_MODE = "approve_then_execute" as const;

function validateContext(ctx: PolicyEvaluationContext): string | null {
  if (!ctx.orgId || !ctx.environment) return "orgId and environment required";
  const grt =
    ctx.metadata && typeof ctx.metadata === "object" && "governanceResourceType" in ctx.metadata
      ? String((ctx.metadata as Record<string, unknown>).governanceResourceType ?? "")
      : "";
  if (!ctx.actionKey && !ctx.playbookKey && !grt) {
    return "actionKey or playbookKey or metadata.governanceResourceType required";
  }
  if (!ctx.requestedMode) return "requestedMode required";
  return null;
}

export type EvaluatePolicyOptions = {
  persistLog?: boolean;
};

export async function evaluate(
  supabase: SupabaseClient,
  context: PolicyEvaluationContext,
  options?: EvaluatePolicyOptions
): Promise<{ data: PolicyDecision; error: Error | null }> {
  const err = validateContext(context);
  if (err) return { data: null as unknown as PolicyDecision, error: new Error(err) };

  const persistLog = options?.persistLog !== false;
  const requestedMode = context.requestedMode ?? DEFAULT_REQUESTED_MODE;

  const { matchedRules: canonical, error: evalError } = await evaluatePolicies(
    supabase,
    context.orgId,
    context.environment,
    context
  );

  if (evalError) return { data: null as unknown as PolicyDecision, error: evalError };

  const [revMatches, apprMatches] = await Promise.all([
    fetchRevenuePolicyAdapterMatches(supabase, context.orgId, context),
    fetchApprovalPolicyAdapterMatches(supabase, context.orgId, context),
  ]);

  const matchedRules = [...canonical, ...revMatches, ...apprMatches];

  let resolved = resolveConflict(matchedRules, requestedMode, "BLOCK");

  let appliedIds: string[] = [];

  if (resolved.finalDisposition === "BLOCK" && resolved.primaryBlockingMatch) {
    const primary = resolved.primaryBlockingMatch;
    const eligible = primary.rule.exceptionEligible !== false;
    if (eligible) {
      const bid = primary.policyId;
      const isCanonicalPolicy =
        /^[0-9a-f-]{36}$/i.test(bid) && !bid.includes("adapter");
      const { exceptions, appliedIds: exIds } = await getApplicableExceptions(
        supabase,
        context.orgId,
        context,
        { blockingPolicyId: isCanonicalPolicy ? bid : null }
      );
      appliedIds = exIds;
      if (exceptions.length > 0) {
        const ex = exceptions[0]!;
        resolved = {
          ...resolved,
          finalDisposition: ex.overrideDisposition,
          decisionReasonCode: "exception_override",
          decisionMessage: `Exception ${ex.exceptionId.slice(0, 8)} applied`,
          effectiveAutonomyMode: (ex.overrideAutonomyMode ??
            resolved.effectiveAutonomyMode) as PolicyDecision["effectiveAutonomyMode"],
          blockedByRules: ex.overrideDisposition === "BLOCK" ? resolved.blockedByRules : [],
          primaryBlockingMatch: null,
        };
      }
    }
  }

  const decision: PolicyDecision = {
    allowed:
      resolved.finalDisposition === "ALLOW" && resolved.approvalRules.length === 0,
    blocked: resolved.finalDisposition === "BLOCK",
    requiresApproval: resolved.finalDisposition === "REQUIRE_APPROVAL",

    finalDisposition: resolved.finalDisposition,
    matchedRules: resolved.matchedRules,
    blockedByRules: resolved.blockedByRules,
    approvalRules: resolved.approvalRules,

    effectiveAutonomyMode: resolved.effectiveAutonomyMode,
    decisionReasonCode: resolved.decisionReasonCode,
    decisionMessage: resolved.decisionMessage,

    requiredApproverRoles: resolved.requiredApproverRoles,
    requiredApprovalCount: resolved.requiredApprovalCount,

    riskScore: null,
    riskBand: null,

    appliedExceptionIds: appliedIds,
    evaluationTraceId: "",
  };

  if (persistLog) {
    const { data: logRow } = await insertPolicyDecisionLog(supabase, {
      org_id: context.orgId,
      issue_id: context.issueId ?? null,
      finding_id: context.findingId ?? null,
      action_key: context.actionKey ?? null,
      playbook_key: context.playbookKey ?? null,
      workflow_step_key: context.workflowStepKey ?? null,
      evaluation_context_json: context as unknown as Record<string, unknown>,
      matched_rules_json: resolved.matchedRules as unknown[],
      blocked_rules_json: resolved.blockedByRules as unknown[],
      approval_rules_json: resolved.approvalRules as unknown[],
      final_disposition: resolved.finalDisposition,
      decision_reason_code: resolved.decisionReasonCode,
      decision_message: resolved.decisionMessage,
      effective_autonomy_mode: resolved.effectiveAutonomyMode,
      required_approver_roles_json: resolved.requiredApproverRoles,
      required_approval_count: resolved.requiredApprovalCount,
      applied_exception_ids_json: appliedIds,
    });
    decision.evaluationTraceId = logRow?.id ?? crypto.randomUUID();
  } else {
    decision.evaluationTraceId = crypto.randomUUID();
  }

  return { data: decision, error: null };
}

export async function evaluateOrThrow(
  supabase: SupabaseClient,
  context: PolicyEvaluationContext,
  options?: EvaluatePolicyOptions
): Promise<PolicyDecision> {
  const { data, error } = await evaluate(supabase, context, options);
  if (error) throw error;
  return data;
}

export async function createApprovalRequest(
  supabase: SupabaseClient,
  decision: PolicyDecision,
  context: PolicyEvaluationContext,
  options?: { createdByType?: string; createdByUserId?: string | null }
): Promise<{ approvalRequestId: string | null; error: Error | null }> {
  if (decision.finalDisposition !== "REQUIRE_APPROVAL") {
    return { approvalRequestId: null, error: new Error("Decision does not require approval") };
  }

  const logId = decision.evaluationTraceId;
  if (!logId) {
    return { approvalRequestId: null, error: new Error("Decision has no evaluation trace (log id)") };
  }

  const { data, error } = await insertApprovalRequest(supabase, {
    org_id: context.orgId,
    issue_id: context.issueId ?? null,
    finding_id: context.findingId ?? null,
    action_key: context.actionKey ?? null,
    playbook_key: context.playbookKey ?? null,
    requested_roles_json: decision.requiredApproverRoles,
    required_approval_count: decision.requiredApprovalCount,
    source_policy_decision_log_id: logId as string,
    request_payload_json: context as unknown as Record<string, unknown>,
    created_by_type: options?.createdByType ?? "policy_engine",
    created_by_user_id: options?.createdByUserId ?? null,
  });

  if (error) return { approvalRequestId: null, error };
  return { approvalRequestId: data?.id ?? null, error: null };
}
