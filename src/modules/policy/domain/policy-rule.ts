/**
 * Phase 3 — Policy rule DSL (§8.2).
 */
import type { PolicyConditionGroup } from "./policy-condition";

export type PolicyRuleEffectBlock = {
  type: "BLOCK";
  reasonCode: string;
  message: string;
};

export type PolicyRuleEffectRequireApproval = {
  type: "REQUIRE_APPROVAL";
  reasonCode: string;
  message: string;
  approverRoles: string[];
  approvalCount: number;
};

export type PolicyRuleEffectAllow = {
  type: "ALLOW";
  reasonCode: string;
  message: string;
};

export type PolicyRuleEffectLimitAutonomy = {
  type: "LIMIT_AUTONOMY_MODE";
  maxMode: "manual_only" | "suggest_only" | "approve_then_execute" | "auto_execute_low_risk" | "auto_execute_policy_bounded";
  reasonCode: string;
  message: string;
};

export type PolicyRuleEffect =
  | PolicyRuleEffectBlock
  | PolicyRuleEffectRequireApproval
  | PolicyRuleEffectAllow
  | PolicyRuleEffectLimitAutonomy;

export type PolicyRule = {
  ruleKey: string;
  description: string;
  match: PolicyConditionGroup;
  effect: PolicyRuleEffect;
  hardBlock: boolean;
  /** When false on a blocking rule, policy exceptions may not override the block. Default true (legacy). */
  exceptionEligible?: boolean;
};

export type { PolicyConditionGroup };
