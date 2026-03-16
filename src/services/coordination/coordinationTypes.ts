export type CoordinationSuggestionSource =
  | "DOMAIN_MAPPING"
  | "SYSTEM_MAPPING"
  | "CHANGE_TYPE_MAPPING"
  | "MANUAL_RULE";

export type CoordinationMissingCoverageType = "DOMAIN" | "SYSTEM" | "CHANGE_TYPE";
export type CoordinationEvidenceSource =
  | "CHANGE_TYPE_RULE"
  | "SYSTEM_RULE"
  | "DOMAIN_RULE"
  | "RISK_RULE";
export type CoordinationRecipientType = "USER" | "ROLE" | "EMAIL_LIST" | "SLACK_CHANNEL";
export type CoordinationChannel = "IN_APP" | "EMAIL" | "SLACK";
export type CoordinationBlockerSeverity = "ERROR" | "WARNING";

export type CoordinationPlan = {
  summary: {
    coordinationSummary: string;
    whyTheseRecommendationsExist: string;
  };
  approvals: {
    suggestedApprovers: Array<{
      userId: string;
      displayName: string;
      role: string;
      source: CoordinationSuggestionSource;
      required: boolean;
      reason: string;
    }>;
    missingCoverage: Array<{
      type: CoordinationMissingCoverageType;
      value: string;
      reason: string;
    }>;
  };
  evidence: {
    requiredItems: Array<{
      kind: string;
      title: string;
      reason: string;
      source: CoordinationEvidenceSource;
    }>;
    recommendedItems: Array<{
      kind: string;
      title: string;
      reason: string;
      source: CoordinationEvidenceSource;
    }>;
  };
  notifications: {
    suggestedRecipients: Array<{
      recipientType: CoordinationRecipientType;
      recipientId: string;
      displayName: string;
      channel: CoordinationChannel;
      reason: string;
    }>;
  };
  blockers: Array<{
    code: string;
    title: string;
    description: string;
    severity: CoordinationBlockerSeverity;
  }>;
  actions: {
    canApplyApprovers: boolean;
    canApplyEvidence: boolean;
    canApplyNotifications: boolean;
  };
};

export type CoordinationInput = {
  inputHash: string;
  change: {
    id: string;
    orgId: string;
    title: string | null;
    description: string | null;
    changeType: string | null;
    domain: string;
    systems: string[];
    revenueImpactArea: string[];
    customerImpact: boolean | null;
    rolloutMethod: string | null;
    backfillRequired: boolean | null;
    status: string | null;
    authorId: string | null;
    visibility: string | null;
    isRestricted: boolean;
    evidenceItems: Array<{
      id?: string;
      kind: string;
      label: string;
      severity?: string;
      status?: string;
    }>;
    approvers: Array<{
      userId: string;
      approvalArea: string;
      decision: string;
    }>;
  };
  org: {
    approvalMappings: Array<{
      triggerType: "DOMAIN" | "SYSTEM" | "CHANGE_TYPE";
      triggerValue: string;
      roleId: string;
      roleName: string;
      enabled: boolean;
      priority: number;
    }>;
    roleMembers: Array<{
      roleId: string;
      roleName: string;
      userId: string;
      email: string | null;
      name: string | null;
      canReview: boolean;
    }>;
    notificationSettings: {
      emailEnabled: boolean;
      notificationEmails: string[];
      slackEnabled: boolean;
      slackDefaultChannelId: string | null;
    };
  };
};

export type SavedCoordinationPlan = {
  id: string;
  org_id: string;
  change_id: string;
  version: number;
  status: "PENDING" | "COMPLETED" | "FAILED";
  input_hash: string;
  plan_json: CoordinationPlan;
  summary_text: string | null;
  is_current: boolean;
  generated_by: "RULES_ONLY" | "HYBRID_AI" | "MANUAL_OVERRIDE";
  created_by_user_id: string | null;
  created_at: string;
  superseded_at: string | null;
};
