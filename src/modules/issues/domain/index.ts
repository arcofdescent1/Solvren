/**
 * Phase 0 — Issues module: domain types and enums.
 * Canonical issue object and lifecycle types.
 */

export { canTransition, allowedTargets, ISSUE_HISTORY_EVENT_TYPES } from "./stateMachine";
export type { IssueHistoryEventType } from "./stateMachine";
export {
  canTriage,
  canAssign,
  canStart,
  canResolve,
  canDismiss,
  canReopen,
  canTransitionTo,
} from "./validators";

export type IssueSeverity = "low" | "medium" | "high" | "critical";
export type IssueStatus =
  | "open"
  | "triaged"
  | "assigned"
  | "in_progress"
  | "resolved"
  | "verified"
  | "dismissed";
export type VerificationStatus = "pending" | "passed" | "failed" | "not_required";
export type IssueSourceType =
  | "change"
  | "detector"
  | "integration_event"
  | "incident"
  | "manual"
  | "system_health"
  | "verification_failure";

export type Issue = {
  id: string;
  org_id: string;
  issue_key: string;
  source_type: IssueSourceType;
  source_ref: string;
  source_event_time: string | null;
  domain_key: string;
  title: string;
  description: string | null;
  summary: string | null;
  severity: IssueSeverity;
  status: IssueStatus;
  verification_status: VerificationStatus;
  priority_score: number | null;
  impact_score: number | null;
  confidence_score: number | null;
  owner_user_id: string | null;
  owner_team_key: string | null;
  sla_policy_key: string | null;
  opened_at: string;
  triaged_at: string | null;
  assigned_at: string | null;
  in_progress_at: string | null;
  resolved_at: string | null;
  verified_at: string | null;
  dismissed_at: string | null;
  closed_reason: string | null;
  reopen_count: number;
  created_by: string | null;
  updated_at: string;
};

export type CreateIssueInput = {
  org_id: string;
  source_type: IssueSourceType;
  source_ref: string;
  source_event_time?: string | null;
  domain_key: string;
  title: string;
  description?: string | null;
  summary?: string | null;
  severity?: IssueSeverity;
  confidence_score?: number | null;
  impact_score?: number | null;
  created_by?: string | null;
};

export type IssueListParams = {
  org_id: string;
  status?: IssueStatus | IssueStatus[];
  source_type?: IssueSourceType | IssueSourceType[];
  severity?: IssueSeverity | IssueSeverity[];
  domain_key?: string;
  verification_status?: VerificationStatus | VerificationStatus[];
  owner_user_id?: string | null;
  limit?: number;
  offset?: number;
};
