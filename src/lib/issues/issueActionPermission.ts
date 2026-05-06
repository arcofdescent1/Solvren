import type { CanonicalPermission } from "@/lib/rbac/permissions";
import type { IssueWorkflowActionType } from "./executeIssueWorkflowAction";

export function permissionForIssueWorkflowAction(action: IssueWorkflowActionType): CanonicalPermission {
  switch (action) {
    case "dismiss":
      return "issues.dismiss";
    case "assign":
      return "issues.assign";
    case "approve":
    case "deny":
    case "request_changes":
      return "issues.approve";
    default:
      return "issues.act";
  }
}
