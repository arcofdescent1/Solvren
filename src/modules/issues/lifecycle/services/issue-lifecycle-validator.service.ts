/**
 * Phase 1 — Lifecycle validator: determines allowed transitions and closure invariants.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  IssueLifecycleState,
  type TerminalClassificationType,
  isValidNoActionReason,
  isValidTerminalClassification,
} from "../domain";
import type { LifecycleValidationResult } from "../domain/lifecycle-validation";
import { getTerminalClassification } from "../repositories/issue-terminal-classification.repository";
import { getNoActionDecision } from "../repositories/issue-no-action-decision.repository";

/** Transition rules: from -> set of allowed to states (with conditions implied by event) */
const TRANSITION_TABLE: Record<string, string[]> = {
  [IssueLifecycleState.DETECTED]: [IssueLifecycleState.IMPACT_ESTIMATED],
  [IssueLifecycleState.IMPACT_ESTIMATED]: [
    IssueLifecycleState.ACTION_PLANNED,
    IssueLifecycleState.NO_ACTION_TAKEN,
  ],
  [IssueLifecycleState.ACTION_PLANNED]: [
    IssueLifecycleState.ACTION_EXECUTED,
    IssueLifecycleState.NO_ACTION_TAKEN,
  ],
  [IssueLifecycleState.ACTION_EXECUTED]: [IssueLifecycleState.VERIFICATION_PENDING],
  [IssueLifecycleState.VERIFICATION_PENDING]: [
    IssueLifecycleState.VERIFIED_SUCCESS,
    IssueLifecycleState.VERIFIED_FAILURE,
  ],
  [IssueLifecycleState.VERIFIED_SUCCESS]: [IssueLifecycleState.CLOSED],
  [IssueLifecycleState.VERIFIED_FAILURE]: [
    IssueLifecycleState.ACTION_PLANNED,
    IssueLifecycleState.CLOSED,
  ],
  [IssueLifecycleState.NO_ACTION_TAKEN]: [IssueLifecycleState.CLOSED],
  [IssueLifecycleState.CLOSED]: [], // reopen via dedicated flow only
};

/** States from which CLOSED is allowed */
const CLOSABLE_FROM = [
  IssueLifecycleState.VERIFIED_SUCCESS,
  IssueLifecycleState.VERIFIED_FAILURE,
  IssueLifecycleState.NO_ACTION_TAKEN,
];

export async function validateTransition(
  supabase: SupabaseClient,
  issueId: string,
  orgId: string,
  fromState: string,
  toState: string,
  options: {
    hasImpactAttempt?: boolean;
    hasActionPlan?: boolean;
    hasActionAttempt?: boolean;
    hasVerificationAttempt?: boolean;
    hasTerminalClassification?: boolean;
    hasNoActionDecision?: boolean;
    noActionReason?: string;
    requiresApproval?: boolean;
    approvedByUserId?: string | null;
    expectedLifecycleVersion?: number;
    actualLifecycleVersion?: number;
  }
): Promise<LifecycleValidationResult> {
  if (fromState === IssueLifecycleState.CLOSED) {
    return {
      allowed: false,
      reasonCode: "issue_already_closed",
      message: "Cannot transition from CLOSED via normal flow; use reopen.",
    };
  }

  if (options.expectedLifecycleVersion != null && options.actualLifecycleVersion != null) {
    if (options.expectedLifecycleVersion !== options.actualLifecycleVersion) {
      return {
        allowed: false,
        reasonCode: "lifecycle_version_conflict",
        message: "Lifecycle version conflict; please refresh and retry.",
      };
    }
  }

  const allowed = TRANSITION_TABLE[fromState];
  if (!allowed || !allowed.includes(toState)) {
    return {
      allowed: false,
      reasonCode: "invalid_transition",
      message: `Transition from ${fromState} to ${toState} is not allowed.`,
    };
  }

  // State-specific conditions
  if (fromState === IssueLifecycleState.DETECTED && toState === IssueLifecycleState.IMPACT_ESTIMATED) {
    if (!options.hasImpactAttempt) {
      return {
        allowed: false,
        reasonCode: "missing_impact_assessment",
        message: "Impact assessment attempt must be recorded.",
      };
    }
  }

  if (
    fromState === IssueLifecycleState.IMPACT_ESTIMATED &&
    toState === IssueLifecycleState.ACTION_PLANNED
  ) {
    if (!options.hasActionPlan) {
      return {
        allowed: false,
        reasonCode: "missing_action_attempt",
        message: "Action plan must exist.",
      };
    }
  }

  if (
    fromState === IssueLifecycleState.IMPACT_ESTIMATED &&
    toState === IssueLifecycleState.NO_ACTION_TAKEN
  ) {
    if (!options.hasNoActionDecision || !options.noActionReason) {
      return {
        allowed: false,
        reasonCode: "missing_no_action_decision",
        message: "No-action decision with approved reason required.",
      };
    }
    if (!isValidNoActionReason(options.noActionReason)) {
      return {
        allowed: false,
        reasonCode: "invalid_transition",
        message: "No-action reason must be from approved enum.",
      };
    }
    if (options.requiresApproval && !options.approvedByUserId) {
      return {
        allowed: false,
        reasonCode: "approval_required",
        message: "Approval required for no-action; approver must be recorded.",
      };
    }
  }

  if (
    fromState === IssueLifecycleState.ACTION_PLANNED &&
    toState === IssueLifecycleState.ACTION_EXECUTED
  ) {
    if (!options.hasActionAttempt) {
      return {
        allowed: false,
        reasonCode: "missing_action_attempt",
        message: "Execution attempt must be recorded.",
      };
    }
  }

  if (
    fromState === IssueLifecycleState.ACTION_EXECUTED &&
    toState === IssueLifecycleState.VERIFICATION_PENDING
  ) {
    // Execution completed or failed-final; implied by event
  }

  if (
    fromState === IssueLifecycleState.VERIFICATION_PENDING &&
    (toState === IssueLifecycleState.VERIFIED_SUCCESS || toState === IssueLifecycleState.VERIFIED_FAILURE)
  ) {
    if (!options.hasVerificationAttempt) {
      return {
        allowed: false,
        reasonCode: "missing_verification_attempt",
        message: "Verification attempt must be recorded.",
      };
    }
  }

  if (toState === IssueLifecycleState.CLOSED) {
    return validateClosureInvariant(supabase, issueId, orgId, fromState, options);
  }

  return { allowed: true };
}

export async function validateClosureInvariant(
  supabase: SupabaseClient,
  issueId: string,
  orgId: string,
  fromState: string,
  options: {
    hasImpactAttempt?: boolean;
    hasActionAttempt?: boolean;
    hasVerificationAttempt?: boolean;
    terminalClassification?: { classificationType: TerminalClassificationType; outcomeSummary: string };
    hasNoActionDecision?: boolean;
    noActionReason?: string;
    approvedByUserId?: string | null;
    requiresApproval?: boolean;
  }
): Promise<LifecycleValidationResult> {
  if (!CLOSABLE_FROM.includes(fromState as typeof CLOSABLE_FROM[number])) {
    return {
      allowed: false,
      reasonCode: "invalid_transition",
      message: `Cannot close from ${fromState}; must be VERIFIED_SUCCESS, VERIFIED_FAILURE, or NO_ACTION_TAKEN.`,
    };
  }

  if (fromState === IssueLifecycleState.NO_ACTION_TAKEN) {
    const { data: noAction } = await getNoActionDecision(supabase, issueId);
    if (!noAction) {
      return {
        allowed: false,
        reasonCode: "missing_no_action_decision",
        message: "No-action decision must be recorded.",
      };
    }
    if (options.requiresApproval && !options.approvedByUserId && !noAction.approved_by_user_id) {
      return {
        allowed: false,
        reasonCode: "approval_required",
        message: "Approval required for no-action closure.",
      };
    }
  }

  // Path A: Action path — need impact, action, verification, outcome
  if (
    fromState === IssueLifecycleState.VERIFIED_SUCCESS ||
    fromState === IssueLifecycleState.VERIFIED_FAILURE
  ) {
    if (!options.terminalClassification) {
      return {
        allowed: false,
        reasonCode: "missing_terminal_classification",
        message: "Terminal classification (outcome) required for closure.",
      };
    }
    if (!isValidTerminalClassification(options.terminalClassification.classificationType)) {
      return {
        allowed: false,
        reasonCode: "invalid_transition",
        message: "Classification type must be resolved_success, resolved_failure, or no_action_closed.",
      };
    }
    if (
      fromState === IssueLifecycleState.VERIFIED_SUCCESS &&
      options.terminalClassification.classificationType !== "resolved_success"
    ) {
      return {
        allowed: false,
        reasonCode: "invalid_transition",
        message: "VERIFIED_SUCCESS must close with resolved_success classification.",
      };
    }
    if (
      fromState === IssueLifecycleState.VERIFIED_FAILURE &&
      options.terminalClassification.classificationType !== "resolved_failure"
    ) {
      return {
        allowed: false,
        reasonCode: "invalid_transition",
        message: "VERIFIED_FAILURE must close with resolved_failure classification.",
      };
    }
  }

  // Path B: No-action path — need terminal classification of no_action_closed
  if (fromState === IssueLifecycleState.NO_ACTION_TAKEN) {
    const { data: classification } = await getTerminalClassification(supabase, issueId);
    if (!classification && !options.terminalClassification) {
      return {
        allowed: false,
        reasonCode: "missing_terminal_classification",
        message: "Terminal classification (no_action_closed) required for no-action closure.",
      };
    }
    if (options.terminalClassification) {
      if (options.terminalClassification.classificationType !== "no_action_closed") {
        return {
          allowed: false,
          reasonCode: "invalid_transition",
          message: "No-action closure requires no_action_closed classification.",
        };
      }
    }
  }

  return { allowed: true };
}

export function getMissingClosureRequirements(
  supabase: SupabaseClient,
  _issueId: string,
  _orgId: string,
  fromState: string,
  checks: {
    hasImpactAttempt: boolean;
    hasActionAttempt: boolean;
    hasVerificationAttempt: boolean;
    hasTerminalClassification: boolean;
    hasNoActionDecision: boolean;
  }
): string[] {
  const missing: string[] = [];

  if (fromState === IssueLifecycleState.CLOSED) return [];

  if (CLOSABLE_FROM.includes(fromState as typeof CLOSABLE_FROM[number])) {
    if (!checks.hasTerminalClassification) {
      missing.push("Terminal classification missing");
    }
    if (fromState === IssueLifecycleState.NO_ACTION_TAKEN && !checks.hasNoActionDecision) {
      missing.push("No-action decision missing");
    }
    return missing;
  }

  if (!checks.hasImpactAttempt) missing.push("Impact assessment missing");
  if (
    (fromState === IssueLifecycleState.VERIFICATION_PENDING ||
      fromState === IssueLifecycleState.VERIFIED_SUCCESS ||
      fromState === IssueLifecycleState.VERIFIED_FAILURE) &&
    !checks.hasActionAttempt
  ) {
    missing.push("Action attempt missing");
  }
  if (
    (fromState === IssueLifecycleState.VERIFIED_SUCCESS ||
      fromState === IssueLifecycleState.VERIFIED_FAILURE) &&
    !checks.hasVerificationAttempt
  ) {
    missing.push("Verification attempt missing");
  }

  return missing;
}
