/**
 * Phase 0 — Input validation and semantic guards for issues.
 */
import type { Issue, IssueStatus } from "./index";
import { canTransition as checkTransition } from "./stateMachine";

export function canTriage(issue: Issue): boolean {
  return issue.status === "open";
}

export function canAssign(issue: Issue): boolean {
  return issue.status === "triaged" || issue.status === "open";
}

export function canStart(issue: Issue): boolean {
  return issue.status === "assigned";
}

export function canResolve(issue: Issue): boolean {
  return issue.status === "in_progress";
}

export function canDismiss(issue: Issue): boolean {
  return ["open", "triaged", "assigned", "in_progress"].includes(issue.status);
}

export function canReopen(issue: Issue): boolean {
  return issue.status === "resolved" || issue.status === "verified" || issue.status === "dismissed";
}

export function canTransitionTo(issue: Issue, toStatus: IssueStatus): boolean {
  return checkTransition(issue.status, toStatus);
}
