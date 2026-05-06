/**
 * Phase 5 — canonical ordinal onboarding model (string steps are not comparable with <).
 */
export const ONBOARDING_STEPS = [
  "NOT_STARTED", // 0
  "REVIEW_PRIVACY_MODE",
  "CONNECT_INTEGRATION",
  "ANALYZING",
  "FIRST_INSIGHTS",
  "FIRST_ACTION",
  "FIRST_RESOLUTION",
  "COMPLETE",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export function getStepIndex(step: string): number {
  const i = ONBOARDING_STEPS.indexOf(step as OnboardingStep);
  return i >= 0 ? i : -1;
}

export function hasReachedStep(current: string, required: string): boolean {
  const ci = getStepIndex(current);
  const ri = getStepIndex(required);
  if (ci < 0 || ri < 0) return false;
  return ci >= ri;
}
