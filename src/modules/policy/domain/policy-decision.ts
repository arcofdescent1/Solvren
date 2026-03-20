/**
 * Phase 3 — Policy decision contract (§6).
 */
export type AutonomyMode =
  | "manual_only"
  | "suggest_only"
  | "approve_then_execute"
  | "auto_execute_low_risk"
  | "auto_execute_policy_bounded"
  | "full_trusted_autonomy";

export type RiskBand = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type PolicyRuleMatch = {
  policyId: string;
  policyKey: string;
  ruleKey: string;
  effect: string;
  reasonCode: string;
  message: string;
  hardBlock?: boolean;
};

export type PolicyDecision = {
  allowed: boolean;
  blocked: boolean;
  requiresApproval: boolean;

  finalDisposition: "ALLOW" | "BLOCK" | "REQUIRE_APPROVAL";

  matchedRules: PolicyRuleMatch[];
  blockedByRules: PolicyRuleMatch[];
  approvalRules: PolicyRuleMatch[];

  effectiveAutonomyMode: AutonomyMode;

  decisionReasonCode: string;
  decisionMessage: string;

  requiredApproverRoles: string[];
  requiredApprovalCount: number;

  riskScore: number | null;
  riskBand: RiskBand | null;

  appliedExceptionIds: string[];
  evaluationTraceId: string;
};
