/**
 * Phase 1 — Canonical lifecycle states for issues.
 */
export enum IssueLifecycleState {
  DETECTED = "DETECTED",
  IMPACT_ESTIMATED = "IMPACT_ESTIMATED",
  ACTION_PLANNED = "ACTION_PLANNED",
  ACTION_EXECUTED = "ACTION_EXECUTED",
  VERIFICATION_PENDING = "VERIFICATION_PENDING",
  VERIFIED_SUCCESS = "VERIFIED_SUCCESS",
  VERIFIED_FAILURE = "VERIFIED_FAILURE",
  NO_ACTION_TAKEN = "NO_ACTION_TAKEN",
  CLOSED = "CLOSED",
}

export const ISSUE_LIFECYCLE_STATES = Object.values(IssueLifecycleState) as string[];

export function isValidLifecycleState(s: string): s is IssueLifecycleState {
  return ISSUE_LIFECYCLE_STATES.includes(s);
}
