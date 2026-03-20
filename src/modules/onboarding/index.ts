export * from "./domain";
export * from "./repositories/org-onboarding-states.repository";
export * from "./repositories/org-onboarding-steps.repository";
export * from "./repositories/org-onboarding-milestones.repository";
export * from "./repositories/playbook-performance-snapshots.repository";
export * from "./repositories/activation-recommendations.repository";
export {
  initializeOnboarding,
  evaluateOnboardingState,
  markStepCompleted,
  markStepBlocked,
  markMilestoneReachedService,
} from "./services/onboarding-engine.service";
export { evaluateSteps } from "./services/onboarding-step-evaluator.service";
export { getContextualRecommendations } from "./services/activation-recommendation.service";
export {
  computePerformanceScore,
  classifyHealthState,
  recordPlaybookExecution,
} from "./services/playbook-performance.service";
export { evaluateAndUpdateOnboarding } from "./services/onboarding-tracker.service";
export type { OnboardingProgress, OnboardingStage } from "./services/onboarding-tracker.service";
export { evaluateFirstValue } from "./services/first-value.service";
export { getRecommendations } from "./services/recommendation.service";
export type { Recommendation, RecommendationType } from "./services/recommendation.service";
export { recordValueEvent } from "./services/value-tracking.service";
