/**
 * Phase 5 — Bind REQUIRE_APPROVAL governance outcomes to approval_requests (v1 single-step).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PolicyDecision, PolicyEvaluationContext } from "@/modules/policy/domain";
import { createApprovalRequest } from "@/modules/policy/services/policy-engine.service";
import type { GovernanceDecision } from "./types/governance-decision";

export async function bindGovernanceApprovalRequest(
  supabase: SupabaseClient,
  gov: GovernanceDecision,
  policyCtx: PolicyEvaluationContext,
  options?: { createdByType?: string; createdByUserId?: string | null }
): Promise<{ approvalRequestId: string | null; error: Error | null }> {
  if (gov.disposition !== "REQUIRE_APPROVAL") {
    return {
      approvalRequestId: null,
      error: new Error("Governance disposition does not require approval"),
    };
  }

  const synthetic: PolicyDecision = {
    allowed: false,
    blocked: false,
    requiresApproval: true,
    finalDisposition: "REQUIRE_APPROVAL",
    matchedRules: [],
    blockedByRules: [],
    approvalRules: [],
    effectiveAutonomyMode: policyCtx.requestedMode ?? "approve_then_execute",
    decisionReasonCode: gov.reasonCodes[0] ?? "governance_require_approval",
    decisionMessage: gov.explainability.headline,
    requiredApproverRoles: gov.approval?.approverRoles ?? [],
    requiredApprovalCount: gov.approval?.quorum ?? 1,
    riskScore: null,
    riskBand: null,
    appliedExceptionIds: [],
    evaluationTraceId: gov.traceId,
  };

  return createApprovalRequest(supabase, synthetic, policyCtx, options);
}
