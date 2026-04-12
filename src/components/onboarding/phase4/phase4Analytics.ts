import { trackAppEvent } from "@/lib/appAnalytics";

export function trackPhase4StepViewed(stepKey: string) {
  trackAppEvent("onboarding_phase4_step_viewed", { stepKey });
}
