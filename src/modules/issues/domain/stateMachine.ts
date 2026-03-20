/**
 * Phase 0 — Issue state machine. Allowed transitions and invariant checks.
 */
import type { IssueStatus, VerificationStatus } from "./index";

const TRANSITIONS: Record<IssueStatus, IssueStatus[]> = {
  open: ["triaged", "assigned", "dismissed"],
  triaged: ["assigned", "open", "dismissed"],
  assigned: ["in_progress", "open", "triaged", "dismissed"],
  in_progress: ["resolved", "open", "dismissed"],
  resolved: ["verified", "open"],
  verified: ["open"],
  dismissed: [],
};

export function canTransition(from: IssueStatus, to: IssueStatus): boolean {
  const allowed = TRANSITIONS[from];
  return allowed != null && allowed.includes(to);
}

export function allowedTargets(from: IssueStatus): IssueStatus[] {
  return TRANSITIONS[from] ?? [];
}

export const ISSUE_HISTORY_EVENT_TYPES = [
  "created",
  "triaged",
  "assigned",
  "started",
  "resolved",
  "verified",
  "dismissed",
  "reopened",
  "owner_changed",
  "action_created",
  "comment_added",
  "change_linked",
  "impact_attached",
  "verification_status_changed",
] as const;

export type IssueHistoryEventType = (typeof ISSUE_HISTORY_EVENT_TYPES)[number];
