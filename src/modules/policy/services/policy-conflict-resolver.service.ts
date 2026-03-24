/**
 * Phase 3 — Policy conflict resolver (§10.3).
 * Phase 5 — Platform vs org precedence, merged approvals, autonomy cap flag.
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

/** Lower tier wins (1 = strongest). */
function conflictTier(m: EvaluatedRuleMatch): number {
  const platform = m.policyOwnerType === "PLATFORM";
  if (m.match.effect === "BLOCK" && m.match.hardBlock) return platform ? 1 : 2;
  if (m.match.effect === "BLOCK") return platform ? 3 : 4;
  if (m.match.effect === "REQUIRE_APPROVAL") return platform ? 5 : 6;
  if (m.match.effect === "LIMIT_AUTONOMY_MODE") return platform ? 7 : 8;
  return 100;
}

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
  /** Canonical blocking rule for exception eligibility (Phase 5). */
  primaryBlockingMatch: EvaluatedRuleMatch | null;
  /** True when LIMIT_AUTONOMY rules capped requested mode (Phase 5 governance UX). */
  autonomyLimited: boolean;
};

export function resolveConflict(
  matchedRules: EvaluatedRuleMatch[],
  requestedMode: AutonomyMode,
  defaultDisposition: "ALLOW" | "BLOCK"
): ResolvedDecision {
  if (matchedRules.length === 0) {
    return {
      finalDisposition: defaultDisposition,
      decisionReasonCode:
        defaultDisposition === "BLOCK" ? "fail_safe_block" : "no_rules_matched",
      decisionMessage:
        defaultDisposition === "BLOCK"
          ? "No matching policy; fail-safe block for write-capable action."
          : "No policy rules matched; applying default.",
      effectiveAutonomyMode: requestedMode,
      requiredApproverRoles: [],
      requiredApprovalCount: 0,
      matchedRules: [],
      blockedByRules: [],
      approvalRules: [],
      primaryBlockingMatch: null,
      autonomyLimited: false,
    };
  }

  const matches = matchedRules.map((m) => m.match);
  const ranked = matchedRules
    .map((m) => ({ m, t: conflictTier(m) }))
    .sort((a, b) => a.t - b.t);
  const minT = ranked[0]!.t;

  if (minT <= 4) {
    const blockMs = ranked.filter((x) => x.t === minT).map((x) => x.m);
    const primary = blockMs[0]!;
    return {
      finalDisposition: "BLOCK",
      decisionReasonCode: primary.match.reasonCode,
      decisionMessage: primary.match.message,
      effectiveAutonomyMode: requestedMode,
      requiredApproverRoles: [],
      requiredApprovalCount: 0,
      matchedRules: matches,
      blockedByRules: blockMs.map((x) => x.match),
      approvalRules: [],
      primaryBlockingMatch: primary,
      autonomyLimited: false,
    };
  }

  if (minT <= 6) {
    const appr = ranked.filter((x) => x.t === 5 || x.t === 6).map((x) => x.m);
    const roles = new Set<string>();
    let quorum = 1;
    for (const m of appr) {
      if (m.rule.effect.type === "REQUIRE_APPROVAL") {
        for (const r of m.rule.effect.approverRoles ?? []) roles.add(r);
        quorum = Math.max(quorum, m.rule.effect.approvalCount ?? 1);
      }
    }
    const first = appr[0]!;
    return {
      finalDisposition: "REQUIRE_APPROVAL",
      decisionReasonCode: first.match.reasonCode,
      decisionMessage: first.match.message,
      effectiveAutonomyMode: requestedMode,
      requiredApproverRoles: [...roles],
      requiredApprovalCount: quorum,
      matchedRules: matches,
      blockedByRules: [],
      approvalRules: appr.map((x) => x.match),
      primaryBlockingMatch: null,
      autonomyLimited: false,
    };
  }

  if (minT <= 8) {
    const lim = ranked
      .filter((x) => x.t === 7 || x.t === 8)
      .sort((a, b) => a.t - b.t)
      .map((x) => x.m);
    let mode = requestedMode;
    for (const m of lim) {
      if (m.rule.effect.type !== "LIMIT_AUTONOMY_MODE") continue;
      const maxMode = m.rule.effect.maxMode;
      const maxIdx = AUTONOMY_MODE_ORDER.indexOf(maxMode);
      const curIdx = AUTONOMY_MODE_ORDER.indexOf(mode);
      mode = curIdx <= maxIdx ? mode : maxMode;
    }
    const first = lim[0]!;
    const autonomyLimited = mode !== requestedMode;
    return {
      finalDisposition: "ALLOW",
      decisionReasonCode: first.match.reasonCode,
      decisionMessage: first.match.message,
      effectiveAutonomyMode: mode,
      requiredApproverRoles: [],
      requiredApprovalCount: 0,
      matchedRules: matches,
      blockedByRules: [],
      approvalRules: [],
      primaryBlockingMatch: null,
      autonomyLimited,
    };
  }

  return {
    finalDisposition: defaultDisposition,
    decisionReasonCode: "no_effectual_rules",
    decisionMessage: "No blocking or approval rules matched; applying default disposition.",
    effectiveAutonomyMode: requestedMode,
    requiredApproverRoles: [],
    requiredApprovalCount: 0,
    matchedRules: matches,
    blockedByRules: [],
    approvalRules: [],
    primaryBlockingMatch: null,
    autonomyLimited: false,
  };
}
