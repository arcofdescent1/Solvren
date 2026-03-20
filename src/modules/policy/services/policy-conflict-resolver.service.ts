/**
 * Phase 3 — Policy conflict resolver (§10.3).
 */
import type { PolicyRuleMatch, AutonomyMode } from "../domain";
import type { EvaluatedRuleMatch } from "./policy-evaluator.service";

const AUTONOMY_MODE_ORDER: AutonomyMode[] = [
  "manual_only",
  "suggest_only",
  "approve_then_execute",
  "auto_execute_low_risk",
  "auto_execute_policy_bounded",
  "full_trusted_autonomy",
];

export type ResolvedDecision = {
  finalDisposition: "ALLOW" | "BLOCK" | "REQUIRE_APPROVAL";
  decisionReasonCode: string;
  decisionMessage: string;
  effectiveAutonomyMode: AutonomyMode;
  requiredApproverRoles: string[];
  requiredApprovalCount: number;
  matchedRules: PolicyRuleMatch[];
  blockedByRules: PolicyRuleMatch[];
  approvalRules: PolicyRuleMatch[];
};

export function resolveConflict(
  matchedRules: EvaluatedRuleMatch[],
  requestedMode: AutonomyMode,
  defaultDisposition: "ALLOW" | "BLOCK"
): ResolvedDecision {
  const matches = matchedRules.map((m) => m.match);
  const hardBlocks = matches.filter((m) => m.hardBlock && m.effect === "BLOCK");
  const blocks = matches.filter((m) => m.effect === "BLOCK");
  const approvals = matches.filter((m) => m.effect === "REQUIRE_APPROVAL");
  const limitAutonomy = matches.filter((m) => m.effect === "LIMIT_AUTONOMY_MODE");

  let finalDisposition: "ALLOW" | "BLOCK" | "REQUIRE_APPROVAL" = "ALLOW";
  let decisionReasonCode = "no_rules_matched";
  let decisionMessage = "No policy rules matched; applying default.";
  let effectiveAutonomyMode = requestedMode;
  let requiredApproverRoles: string[] = [];
  let requiredApprovalCount = 0;

  if (hardBlocks.length > 0) {
    finalDisposition = "BLOCK";
    const r = hardBlocks[0];
    decisionReasonCode = r.reasonCode;
    decisionMessage = r.message;
  } else if (blocks.length > 0) {
    finalDisposition = "BLOCK";
    const r = blocks[0];
    decisionReasonCode = r.reasonCode;
    decisionMessage = r.message;
  } else if (approvals.length > 0) {
    finalDisposition = "REQUIRE_APPROVAL";
    const am = matchedRules.find((m) => m.match.effect === "REQUIRE_APPROVAL");
    if (am) {
      const r = am.match;
      decisionReasonCode = r.reasonCode;
      decisionMessage = r.message;
      if (am.rule.effect.type === "REQUIRE_APPROVAL") {
        requiredApproverRoles = am.rule.effect.approverRoles ?? [];
        requiredApprovalCount = am.rule.effect.approvalCount ?? 1;
      }
    }
  } else if (limitAutonomy.length > 0) {
    const am = matchedRules.find((m) => m.match.effect === "LIMIT_AUTONOMY_MODE");
    if (am?.rule.effect.type === "LIMIT_AUTONOMY_MODE") {
      const r = am.match;
      const maxMode = am.rule.effect.maxMode;
      const maxIdx = AUTONOMY_MODE_ORDER.indexOf(maxMode);
      const reqIdx = AUTONOMY_MODE_ORDER.indexOf(requestedMode);
      effectiveAutonomyMode = reqIdx <= maxIdx ? requestedMode : maxMode;
      decisionReasonCode = r.reasonCode;
      decisionMessage = r.message;
    }
  } else {
    finalDisposition = defaultDisposition;
    if (defaultDisposition === "BLOCK") {
      decisionReasonCode = "fail_safe_block";
      decisionMessage = "No matching policy; fail-safe block for write-capable action.";
    }
  }

  return {
    finalDisposition,
    decisionReasonCode,
    decisionMessage,
    effectiveAutonomyMode,
    requiredApproverRoles,
    requiredApprovalCount,
    matchedRules: matches,
    blockedByRules: hardBlocks.length > 0 ? hardBlocks : blocks,
    approvalRules: approvals,
  };
}
