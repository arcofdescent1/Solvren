/**
 * Phase 10 — Onboarding milestones (§8).
 */
export const ONBOARDING_MILESTONE_KEYS = [
  "org_created",
  "first_user_invited",
  "first_integration_connected",
  "first_signal_received",
  "first_issue_detected",
  "first_playbook_enabled",
  "first_action_executed",
  "first_verification_completed",
  "first_recovered_revenue",
  "first_avoided_loss",
  "onboarding_activated",
] as const;

export type OnboardingMilestoneKey = (typeof ONBOARDING_MILESTONE_KEYS)[number];

export const FIRST_VALUE_MILESTONES: OnboardingMilestoneKey[] = [
  "first_issue_detected",
  "first_recovered_revenue",
  "first_avoided_loss",
];

export type OnboardingMilestone = {
  id: string;
  orgId: string;
  milestoneKey: OnboardingMilestoneKey;
  reached: boolean;
  reachedAt?: string | null;
  detailPayloadJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};
