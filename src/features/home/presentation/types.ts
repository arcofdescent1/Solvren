export type HomeObjectType = "Issue" | "Change" | "Action";

export type HomeWorkItem = {
  id: string;
  objectType: HomeObjectType;
  title: string;
  why: string;
  urgency: "critical" | "high" | "medium" | "low";
  nextStep:
    | "Review approvals"
    | "Add supporting details"
    | "Open issue"
    | "Retry notifications"
    | "View change"
    | "Resolve issue"
    | "See Action Center"
    | "Monitoring"
    | "No action needed";
  destination: string;
  dueLabel?: string;
  waitingReason?: string;
  waitingOn?: string;
  assignedToCurrentUser: boolean;
  highImpact: boolean;
  overdue: boolean;
  linkedToActiveIssue: boolean;
  blocked: boolean;
  retryRequired: boolean;
  rankBoost?: number;
};

export type HomeExposureMetric = {
  label: string;
  value: string;
  tooltip: string;
};

export type HomeActivityItem = {
  id: string;
  title: string;
  context?: string;
  relativeTime: string;
  destination: string;
  objectType: HomeObjectType | "System";
};

export type HomeProtectionCard = {
  label: string;
  value: string;
  tone: "healthy" | "warning" | "neutral";
};
