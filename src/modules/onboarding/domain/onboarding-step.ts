/**
 * Phase 10 — Onboarding step model (§10).
 */
export type OnboardingStepStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "BLOCKED"
  | "SKIPPED";

export type OnboardingStepGroup =
  | "org_setup"
  | "integrations"
  | "detection"
  | "playbooks"
  | "automation"
  | "roi";

export type OnboardingStep = {
  id: string;
  orgId: string;
  stepKey: string;
  stepGroup: OnboardingStepGroup;
  displayName: string;
  description: string;
  stepStatus: OnboardingStepStatus;
  required: boolean;
  blockedReasonCode?: string | null;
  blockedReasonText?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export const DEFAULT_ONBOARDING_STEPS: Array<{
  stepKey: string;
  stepGroup: OnboardingStepGroup;
  displayName: string;
  description: string;
  required: boolean;
}> = [
  { stepKey: "confirm_org_profile", stepGroup: "org_setup", displayName: "Confirm org profile", description: "Verify your organization details", required: true },
  { stepKey: "invite_team_member", stepGroup: "org_setup", displayName: "Invite team member", description: "Add a colleague to your team", required: false },
  { stepKey: "connect_primary_integration", stepGroup: "integrations", displayName: "Connect primary integration", description: "Connect Stripe, CRM, or another primary integration", required: true },
  { stepKey: "connect_secondary_integration", stepGroup: "integrations", displayName: "Connect secondary integration", description: "Optional: connect additional integrations", required: false },
  { stepKey: "receive_first_signal", stepGroup: "detection", displayName: "Receive first signal", description: "Wait for your first integration signal", required: true },
  { stepKey: "detect_first_issue", stepGroup: "detection", displayName: "Detect first issue", description: "Identify your first revenue or funnel issue", required: true },
  { stepKey: "enable_first_playbook", stepGroup: "playbooks", displayName: "Enable first playbook", description: "Turn on a recommended playbook", required: true },
  { stepKey: "review_first_recommended_action", stepGroup: "playbooks", displayName: "Review first action", description: "Review and approve or execute a recommended action", required: false },
  { stepKey: "set_first_execution_mode", stepGroup: "automation", displayName: "Set execution mode", description: "Choose how much automation to allow", required: false },
  { stepKey: "review_safe_mode", stepGroup: "automation", displayName: "Review safe mode", description: "Understand automation safety settings", required: false },
  { stepKey: "view_first_value_timeline", stepGroup: "roi", displayName: "View first value", description: "See recovered revenue or avoided loss in your timeline", required: true },
  { stepKey: "view_playbook_performance", stepGroup: "roi", displayName: "View playbook performance", description: "Review playbook effectiveness", required: false },
];
