/**
 * Phase 5 — Unified governance evaluation (canonical policy engine + legacy adapters).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AutonomyMode, PolicyDecision } from "@/modules/policy/domain";
import { evaluate } from "@/modules/policy/services/policy-engine.service";
import { governanceContextToPolicyContext } from "./map-governance-context";
import type { GovernanceAutonomyMode, GovernanceEvaluationContext } from "./types/governance-context";
import type { GovernanceDecision, GovernanceDisposition } from "./types/governance-decision";

function policyModeToGovernance(mode: AutonomyMode): GovernanceAutonomyMode {
  switch (mode) {
    case "manual_only":
      return "MANUAL";
    case "suggest_only":
      return "SUGGESTED";
    case "approve_then_execute":
      return "ASSISTED";
    case "auto_execute_low_risk":
    case "auto_execute_policy_bounded":
      return "AUTO";
    default:
      return "ASSISTED";
  }
}

function toGovernanceDecision(
  d: PolicyDecision,
  requested: AutonomyMode,
  traceId: string
): GovernanceDecision {
  let disposition: GovernanceDisposition = "ALLOW";
  if (d.blocked) disposition = "BLOCK";
  else if (d.requiresApproval) disposition = "REQUIRE_APPROVAL";
  else if (!d.blocked && !d.requiresApproval && d.effectiveAutonomyMode !== requested) {
    disposition = "LIMIT_AUTONOMY";
  }

  const matchedPolicyIds = [
    ...new Set(d.matchedRules.map((r) => r.policyId).filter(Boolean)),
  ];
  const matchedRuleIds = [...new Set(d.matchedRules.map((r) => r.ruleKey).filter(Boolean))];

  const reasonCodes = [d.decisionReasonCode, ...d.appliedExceptionIds.map((id) => `exception:${id}`)].filter(
    Boolean
  ) as string[];

  const details: string[] = [];
  if (d.matchedRules.length) {
    details.push(`Matched ${d.matchedRules.length} rule(s).`);
  }
  if (d.appliedExceptionIds.length) {
    details.push(`Applied exceptions: ${d.appliedExceptionIds.join(", ")}`);
  }

  const decision: GovernanceDecision = {
    disposition,
    reasonCodes,
    matchedPolicyIds,
    matchedRuleIds,
    explainability: {
      headline: d.decisionMessage || disposition,
      details,
    },
    traceId,
    autonomy: {
      effectivePolicyMode: d.effectiveAutonomyMode,
      maxMode: policyModeToGovernance(d.effectiveAutonomyMode),
    },
  };

  if (d.requiresApproval) {
    decision.approval = {
      required: true,
      approverRoles: d.requiredApproverRoles,
      quorum: d.requiredApprovalCount,
      policySource: "canonical_policy_engine",
    };
  }

  return decision;
}

export type EvaluateGovernanceOptions = {
  persistDecisionLog?: boolean;
};

export async function evaluateGovernance(
  supabase: SupabaseClient,
  ctx: GovernanceEvaluationContext,
  options?: EvaluateGovernanceOptions
): Promise<{
  data: GovernanceDecision | null;
  policyContext: ReturnType<typeof governanceContextToPolicyContext> | null;
  policyDecision: PolicyDecision | null;
  error: Error | null;
}> {
  const policyCtx = governanceContextToPolicyContext(ctx);
  const persist = options?.persistDecisionLog !== false;

  const { data: policyDecision, error } = await evaluate(supabase, policyCtx, {
    persistLog: persist,
  });

  if (error || !policyDecision) {
    return { data: null, policyContext: policyCtx, policyDecision: null, error: error ?? new Error("No decision") };
  }

  const requested = policyCtx.requestedMode ?? "approve_then_execute";
  const gov = toGovernanceDecision(
    policyDecision,
    requested,
    policyDecision.evaluationTraceId
  );

  return {
    data: gov,
    policyContext: policyCtx,
    policyDecision,
    error: null,
  };
}
