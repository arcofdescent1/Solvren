/**
 * Phase 2 — transition validation (status + approval_state constraints).
 */
import { normalizeIssueWorkflowStatus, type ApprovalState, type IssueWorkflowStatus } from "./issuePhase2Types";

export type TransitionValidationResult =
  | { ok: true }
  | { ok: false; error: string };

/** High-impact rule: severity high OR revenue_impact_cents >= 500_000 ($5,000). */
export function isHighImpact(params: {
  severity: string;
  revenueImpactCents: number;
}): boolean {
  const sev = params.severity.toLowerCase();
  if (sev === "high" || sev === "critical") return true;
  return params.revenueImpactCents >= 500_000;
}

/** Calendar-day SLA on create (Phase 2 simplification). */
export function defaultSlaDueAtFromSeverity(severity: string): Date {
  const s = severity.toLowerCase();
  const days =
    s === "critical" || s === "high"
      ? 1
      : s === "medium"
        ? 5
        : 10;
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function defaultApprovalStateForNewIssue(params: {
  severity: string;
  revenueImpactCents: number;
}): ApprovalState {
  return isHighImpact(params) ? "pending" : "not_required";
}

function forbiddenCombo(status: IssueWorkflowStatus, approval: ApprovalState): boolean {
  if (approval === "pending" && (status === "in_progress" || status === "resolved" || status === "verified")) {
    return true;
  }
  return false;
}

/**
 * User-driven status edges only. `verified` is system-driven (not manual).
 * `resolved → verified` uses {@link validateSystemVerifiedTransition}.
 */
const ALLOWED_EDGES: Partial<Record<IssueWorkflowStatus, IssueWorkflowStatus[]>> = {
  detected: ["acknowledged", "assigned", "dismissed"],
  acknowledged: ["assigned", "dismissed"],
  assigned: ["in_progress", "dismissed"],
  in_progress: ["resolved", "dismissed"],
  resolved: ["reopened"],
  verified: [],
  dismissed: ["reopened"],
  reopened: ["acknowledged", "assigned", "dismissed"],
};

export function validateApprovalAction(params: {
  action: "approve" | "deny" | "request_changes";
  approvalState: ApprovalState;
}): TransitionValidationResult {
  const { action, approvalState } = params;
  if (action === "approve") {
    if (approvalState !== "pending" && approvalState !== "changes_requested") {
      return { ok: false, error: "Nothing to approve" };
    }
  }
  if (action === "deny") {
    if (approvalState !== "pending") {
      return { ok: false, error: "Can only deny while approval is pending" };
    }
  }
  if (action === "request_changes") {
    if (approvalState !== "pending") {
      return { ok: false, error: "Can only request changes while approval is pending" };
    }
  }
  return { ok: true };
}

export function validateTransition(params: {
  fromStatus: IssueWorkflowStatus | string;
  toStatus: IssueWorkflowStatus | string;
  approvalState: ApprovalState;
  nextApproval?: ApprovalState;
}): TransitionValidationResult {
  const fromStatus = normalizeFromIssuePhase2(params.fromStatus);
  const toStatus = normalizeFromIssuePhase2(params.toStatus);
  const approvalState = params.approvalState;
  const nextApproval = params.nextApproval;

  if (forbiddenCombo(toStatus, nextApproval ?? approvalState)) {
    return { ok: false, error: "Invalid status for pending approval" };
  }

  if (approvalState === "pending" && (toStatus === "in_progress" || toStatus === "resolved")) {
    return { ok: false, error: "Approve or deny before moving to in_progress or resolved" };
  }

  if (approvalState === "changes_requested" && toStatus === "resolved") {
    return { ok: false, error: "Resolve the change request (re-approval) before closing" };
  }

  const allowed = ALLOWED_EDGES[fromStatus];
  if (!allowed?.includes(toStatus)) {
    return { ok: false, error: `Cannot transition from ${fromStatus} to ${toStatus}` };
  }
  return { ok: true };
}

function normalizeFromIssuePhase2(s: IssueWorkflowStatus | string): IssueWorkflowStatus {
  return typeof s === "string" ? normalizeIssueWorkflowStatus(s) : s;
}

/** Automation only — e.g. SLA verifier job marks resolved issues verified. */
export function validateSystemVerifiedTransition(params: {
  fromStatus: IssueWorkflowStatus | string;
  toStatus: IssueWorkflowStatus | string;
  approvalState: ApprovalState;
}): TransitionValidationResult {
  const fromStatus = normalizeFromIssuePhase2(params.fromStatus);
  const toStatus = normalizeFromIssuePhase2(params.toStatus);
  if (toStatus !== "verified") {
    return { ok: false, error: "System transition must target verified" };
  }
  if (fromStatus !== "resolved") {
    return { ok: false, error: "Only resolved issues can become verified" };
  }
  if (params.approvalState !== "approved" && params.approvalState !== "not_required") {
    return { ok: false, error: "Verified requires approved or not_required approval_state" };
  }
  return { ok: true };
}
