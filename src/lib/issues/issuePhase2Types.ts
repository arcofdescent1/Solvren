/** Phase 2 — locked status + approval vocabulary (matches DB checks). */

export type IssueWorkflowStatus =
  | "detected"
  | "acknowledged"
  | "assigned"
  | "in_progress"
  | "resolved"
  | "verified"
  | "dismissed"
  | "reopened";

export type ApprovalState =
  | "not_required"
  | "pending"
  | "approved"
  | "denied"
  | "changes_requested";

export const ISSUE_WORKFLOW_STATUSES: IssueWorkflowStatus[] = [
  "detected",
  "acknowledged",
  "assigned",
  "in_progress",
  "resolved",
  "verified",
  "dismissed",
  "reopened",
];

export const APPROVAL_STATES: ApprovalState[] = [
  "not_required",
  "pending",
  "approved",
  "denied",
  "changes_requested",
];

export function parseIssueWorkflowStatus(s: string): IssueWorkflowStatus | null {
  return (ISSUE_WORKFLOW_STATUSES as string[]).includes(s) ? (s as IssueWorkflowStatus) : null;
}

export function parseApprovalState(s: string): ApprovalState | null {
  return (APPROVAL_STATES as string[]).includes(s) ? (s as ApprovalState) : null;
}

/** Normalize DB / legacy labels to Phase 2 workflow status (post–migration 211). */
export function normalizeIssueWorkflowStatus(raw: string): IssueWorkflowStatus {
  const s = String(raw ?? "").toLowerCase();
  if (s === "open") return "detected";
  if (s === "triaged") return "acknowledged";
  const parsed = parseIssueWorkflowStatus(raw);
  return parsed ?? "detected";
}

/** Active workload — excludes terminal states (resolved, verified, dismissed). */
export const ACTIVE_ISSUE_WORKFLOW_STATUSES: IssueWorkflowStatus[] = [
  "detected",
  "acknowledged",
  "assigned",
  "in_progress",
  "reopened",
];

export function isActiveIssueWorkflowStatus(status: IssueWorkflowStatus): boolean {
  return !["resolved", "verified", "dismissed"].includes(status);
}

/**
 * Use in `.in("status", …)` for “open queue” views and metrics.
 * Includes legacy `open` / `triaged` and Phase 2 `detected` / `acknowledged`.
 */
export const OPEN_ISSUE_QUEUE_STATUSES: string[] = [
  "open",
  "triaged",
  "detected",
  "acknowledged",
  "assigned",
  "in_progress",
  "reopened",
];

/** @deprecated prefer OPEN_ISSUE_QUEUE_STATUSES */
export const OPEN_WORKLOAD_ISSUE_STATUSES = OPEN_ISSUE_QUEUE_STATUSES;
