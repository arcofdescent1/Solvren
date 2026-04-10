import type { ExecutiveChangeView } from "@/lib/executive/types";
import type { OrgRole } from "@/lib/rbac/roles";

export type AttentionEventType =
  | "CHANGE_CREATED"
  | "APPROVAL_REQUIRED"
  | "READINESS_BLOCKED"
  | "APPROVAL_CONFLICT"
  | "RISK_ESCALATED"
  | "DEPLOYMENT_NEAR"
  | "EXECUTIVE_OVERRIDE"
  | "CHANGE_UPDATED";

export type RoutingPersona =
  | "EXECUTIVE"
  | "SENIOR_TECH_LEADER"
  | "DEPARTMENT_LEADER"
  | "OPERATOR"
  | "SUBMITTER"
  | "WATCHER";

export type AttentionRouteType = "IMMEDIATE" | "DAILY_DIGEST" | "WEEKLY_DIGEST" | "SUPPRESS";

export type AttentionChannel = "SLACK_DM" | "EMAIL" | "IN_APP";

export type DeliveryTemplate =
  | "EXECUTIVE_ALERT"
  | "OPERATOR_ALERT"
  | "APPROVAL_REQUEST"
  | "FYI"
  | "DIGEST_ITEM";

export type AttentionActionType = "APPROVE" | "REVIEW" | "FYI";

export type AttentionRoutingResult = {
  userId: string;
  persona: RoutingPersona;
  routeType: AttentionRouteType;
  channel: AttentionChannel;
  deliveryTemplate: DeliveryTemplate;
  requiresAction: boolean;
  actionType?: AttentionActionType;
  reason: string;
  primaryReasonCode: AttentionDriverCode;
};

export type AttentionDriverCode =
  | "DIRECT_APPROVAL_REQUIRED"
  | "CONFLICT_JUDGMENT"
  | "READINESS_BLOCKED_DOMAIN"
  | "REVENUE_THRESHOLD"
  | "DEPLOY_URGENCY"
  | "EXEC_OVERLAY_BLOCK"
  | "HIGH_RISK"
  | "RECOMMENDATION_ESCALATE"
  | "RECOMMENDATION_DELAY"
  | "OPEN_INCIDENT"
  | "DIGEST_FYI"
  | "ROUTINE";

export type OrgAttentionSettingsResolved = {
  executiveRevenueThresholdUsd: number;
  seniorTechRevenueThresholdUsd: number;
  departmentLeaderRevenueThresholdUsd: number;
  immediateDeployWindowHours: number;
  digestIncludeMediumRisk: boolean;
  suppressLowRiskExecNotifications: boolean;
  executiveDefaultRoute: Exclude<AttentionRouteType, "SUPPRESS">;
  seniorTechDefaultRoute: Exclude<AttentionRouteType, "SUPPRESS">;
  departmentLeaderDefaultRoute: Exclude<AttentionRouteType, "SUPPRESS">;
  operatorDefaultRoute: Exclude<AttentionRouteType, "SUPPRESS">;
  attentionDailyDigestEnabled: boolean;
  attentionWeeklyDigestEnabled: boolean;
  fallbackOperatorUserId: string | null;
};

export type MemberRoutingInfo = {
  userId: string;
  orgRole: OrgRole;
  roleKeysUpper: string[];
  persona: RoutingPersona;
};

export type PendingApprovalRow = {
  id: string;
  approval_area: string | null;
  decision: string | null;
  approver_user_id: string | null;
};

export type AttentionContext = {
  orgId: string;
  changeId: string;
  /** Change creator */
  createdByUserId: string | null;
  view: ExecutiveChangeView;
  settings: OrgAttentionSettingsResolved;
  members: MemberRoutingInfo[];
  approvals: PendingApprovalRow[];
  /** Domain key from change */
  domain: string | null;
  /** True if pending EXEC approval rows exist */
  executiveSignoffRequired: boolean;
  candidateRecipientUserIds: string[];
};

export type MaterialSnapshotV1 = {
  recommendation: ExecutiveChangeView["recommendation"];
  riskLevel: ExecutiveChangeView["riskLevel"];
  blockedCount: number;
  approvalConflict: boolean;
  revenueBand: "NONE" | "LOW" | "MID" | "HIGH";
  deployUrgencyBucket: "NONE" | "SOON" | "IMMINENT";
  executiveOverlay: ExecutiveChangeView["executiveOverlay"];
  primaryReasonCode: AttentionDriverCode;
};
