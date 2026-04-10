export type ExecutiveRecommendation =
  | "PROCEED"
  | "PROCEED_WITH_CAUTION"
  | "DELAY"
  | "ESCALATE";

export type ExecutiveRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ReadinessCategoryStatus = "READY" | "PENDING" | "BLOCKED";

export type ReadinessCategoryKey =
  | "Engineering"
  | "QA"
  | "Support"
  | "Sales"
  | "Finance"
  | "Rollback Plan"
  | "Monitoring / Alerting";

export type ReadinessRow = {
  category: ReadinessCategoryKey;
  status: ReadinessCategoryStatus;
  owner: string | null;
  updatedAt: string | null;
};

export type ExecutiveDecisionApi = "APPROVE" | "DELAY" | "ESCALATE" | "REQUEST_INFO";

export type ExecutiveDecisionState = "NONE" | "APPROVED" | "DELAYED" | "ESCALATED" | "REQUESTED_INFO";

export type SignoffSummary = {
  approved: string[];
  pending: string[];
  rejected: string[];
};

export type ExecutiveChangeView = {
  id: string;
  title: string;
  changeType: string;
  status: string;
  riskLevel: ExecutiveRiskLevel;
  recommendation: ExecutiveRecommendation;
  confidenceScore: number;
  confidenceLabel: "High confidence" | "Moderate confidence" | "Low confidence";
  scheduledAt: string | null;
  revenueAtRisk: number | null;
  revenueAtRiskPeriod: "MONTHLY" | "ONE_TIME";
  displayRevenueAtRisk: string | null;
  customersAffected: number | null;
  customersAffectedDisplay: string | null;
  departmentsAffected: string[];
  systemsAffected: string[];
  readiness: ReadinessRow[];
  signoffs: SignoffSummary;
  attentionSummary: string[];
  hasApprovalConflict: boolean;
  approvalConflictMessage: string | null;
  executiveOverlay: ExecutiveDecisionState;
  technicalDetails: {
    signals: Array<{ key: string; detail?: string }>;
    policyViolations: Array<Record<string, unknown>>;
    incidents: Array<{ id: string; status: string | null }>;
    notes: Array<{ action: string; at: string }>;
  };
  /** Primary Slack concern line + count of additional concerns */
  slackPrimaryConcern: { primary: string; moreCount: number };
  revenueEscalationThresholdUsd: number;
  /** False when no impact assessment row exists (executive-lite copy) */
  hasRiskAssessment: boolean;
};
